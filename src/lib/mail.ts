import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { demoFlagEnabled } from "./deployment";

/**
 * Outbound email seam.
 *
 * Primary transport: Amazon SES — activates when SES_FROM_EMAIL is set.
 * BAA-covered under the same AWS account/BAA as RDS (see src/lib/db.ts),
 * so this is the only transport allowed to carry mail once real patients
 * enroll. The from address must be a verified SES identity (see
 * .env.example), and the account must be out of the SES sandbox to send to
 * arbitrary recipient addresses.
 *
 * Fallback transport: Gmail SMTP (free, no BAA) — demo/dev phase only.
 * Deliberately never used when NODE_ENV=production, even if the env vars
 * are still set, so a stray leftover Gmail credential can't silently carry
 * mail through a non-BAA path once this is deployed for real.
 *
 * Without any transport configured, dev prints codes to the server console
 * and production refuses to send rather than failing silently - unless
 * DEMO_LOG_OTP_CODES=true, a demo-only escape hatch documented below.
 *
 * PHI note: OTP messages deliberately contain no health information — just a
 * code. Never add prescription, appointment, or medical content to any email
 * sent through a non-BAA transport.
 */

const sesFromEmail = process.env.SES_FROM_EMAIL;
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const isProduction = process.env.NODE_ENV === "production";

const sesTransporter = sesFromEmail
  ? nodemailer.createTransport({
      SES: {
        sesClient: new SESv2Client({ region: process.env.AWS_REGION }),
        SendEmailCommand,
      },
    })
  : null;

const gmailTransporter =
  !isProduction && gmailUser && gmailPass
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      })
    : null;

const transporter = sesTransporter ?? gmailTransporter;
const fromAddress = sesTransporter ? sesFromEmail! : gmailUser;

/**
 * DEMO ESCAPE HATCH - writes OTP codes and reset links to the server log
 * instead of emailing them, so a deployment with no mail transport can still
 * complete a registration during a walkthrough.
 *
 * Covers every send path: login/verification codes, password-reset links, and
 * the contact-form notification.
 *
 * This is NOT a transport and must never be on when real patients exist:
 *  - Anyone who can read the service logs can read a login code, which
 *    defeats the second factor for as long as that code stays valid.
 *  - Hosting-platform logs are retained and readable by everyone with
 *    dashboard access to the account.
 *
 * It is opt-in, exact-match "true", and unreachable whenever a real
 * transport is configured (those paths return before reaching it).
 * Unset it before this deployment carries anything but fake data. It is
 * refused outright on the AWS/RDS production deployment (see deployment.ts).
 */
const demoLogCodes = demoFlagEnabled("DEMO_LOG_OTP_CODES");
// Name kept for continuity with what is already deployed and documented; the
// flag governs every send path below, not only the OTP one.

function demoLog(kind: string, to: string, value: string): void {
  console.warn(
    [
      "",
      `[DEMO_LOG_OTP_CODES] Mail is not configured; ${kind} written to the log instead of being sent.`,
      `[DEMO_LOG_OTP_CODES] To: ${to}`,
      `[DEMO_LOG_OTP_CODES] ${kind}: ${value}`,
      "[DEMO_LOG_OTP_CODES] Demo use only - unset this variable before real patient data exists.",
      "",
    ].join("\n")
  );
}

/**
 * Sent from a no-reply address on the pharmacy's own domain — a domain
 * identity is what lets DKIM align and keeps login codes out of spam.
 *
 * These messages deliberately carry NO reply-to. The domain has no mailbox,
 * so a reply goes nowhere; rather than let a patient believe they have
 * reached the pharmacy, the message body tells them where to go instead.
 * Routing replies to a consumer inbox was the alternative, and it would put
 * a channel that can carry health information outside the BAA.
 */
const NO_REPLY_NOTE =
  "Please do not reply to this email — this address is not monitored. " +
  "For help, call the pharmacy or use the contact form at " +
  (process.env.APP_BASE_URL ?? "https://rxlibertypharmacy.com") + "/contact.";

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "email_verify" | "login_mfa"
): Promise<void> {
  const subject =
    purpose === "email_verify"
      ? "Verify your Liberty Pharmacy account"
      : "Your Liberty Pharmacy sign-in code";

  const intro =
    purpose === "email_verify"
      ? "Use this code to activate your Liberty Pharmacy account:"
      : "Use this code to finish signing in to Liberty Pharmacy:";

  if (transporter) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy" <${fromAddress}>`,
      to,
      subject,
      text: `${intro}\n\n${code}\n\nThis code expires in 10 minutes. If you didn't request it, you can ignore this email.\n\n${NO_REPLY_NOTE}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">${intro}</p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1b2a47;text-align:center;background:#f1f5f9;border-radius:8px;padding:16px 0">${code}</p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:16px">${NO_REPLY_NOTE}</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Dev-only fallback: surface the code in the terminal running `npm run dev`.
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] Code: ${code}\n`);
    return;
  }

  if (demoLogCodes) {
    demoLog("verification code", to, code);
    return;
  }

  throw new Error("Email transport not configured — cannot send verification codes in production.");
}

/** `resetUrl` already has the single-use token embedded — see requestPasswordReset in src/lib/auth.ts. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your Liberty Pharmacy password";

  if (transporter) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy" <${fromAddress}>`,
      to,
      subject,
      text: `A password reset was requested for your Liberty Pharmacy account.\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request it, you can ignore this email — your password won't change.\n\n${NO_REPLY_NOTE}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">A password reset was requested for your account. Click below to choose a new password:</p>
          <p style="text-align:center;padding:8px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#1b2a47;color:#fff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px">Reset password</a>
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">This link expires in 30 minutes. If you didn't request it, you can safely ignore this email — your password won't change.</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:16px">${NO_REPLY_NOTE}</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] Reset link: ${resetUrl}\n`);
    return;
  }

  if (demoLogCodes) {
    demoLog("reset link", to, resetUrl);
    return;
  }

  throw new Error("Email transport not configured — cannot send password reset links in production.");
}

/**
 * Sent instead of a verification code when someone registers an email that
 * already has an account. The registration response is identical either way
 * (SEC-002), so this is how the real owner finds out — and, if it was them,
 * how they get back in.
 */
export async function sendAccountExistsEmail(to: string, signInUrl: string, forgotUrl: string): Promise<void> {
  const subject = "Someone tried to create a Liberty Pharmacy account with your email";
  const text =
    `Someone just tried to create a new Liberty Pharmacy account using this email address, ` +
    `but you already have an account with us.\n\n` +
    `If that was you, sign in here: ${signInUrl}\n` +
    `Forgot your password? Reset it here: ${forgotUrl}\n\n` +
    `If it wasn't you, you can ignore this email — no new account was created and nothing about your account has changed.\n\n` +
    NO_REPLY_NOTE;

  if (transporter) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy" <${fromAddress}>`,
      to,
      subject,
      text,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">Someone just tried to create a new account using this email address, but you already have an account with us.</p>
          <p style="text-align:center;padding:8px 0">
            <a href="${signInUrl}" style="display:inline-block;background:#1b2a47;color:#fff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px">Sign in</a>
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">Forgot your password? <a href="${forgotUrl}" style="color:#1b2a47">Reset it here</a>. If this wasn't you, you can safely ignore this email — no new account was created and nothing about your account has changed.</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:16px">${NO_REPLY_NOTE}</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n`);
    return;
  }

  if (demoLogCodes) {
    demoLog("account-exists notice", to, signInUrl);
    return;
  }

  throw new Error("Email transport not configured — cannot send account notices in production.");
}

export interface ContactMessageInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

/**
 * Notifies the pharmacy that a contact-form submission has arrived.
 *
 * Deliberately carries NO message content — not the body, not the sender's
 * name, email, or phone. The submission itself is already stored encrypted
 * (see contact_messages in src/lib/db.ts) and is read in the admin panel,
 * which sits behind MFA and writes an audit entry for every view.
 *
 * The route screens submissions for obvious PHI patterns, but free-text
 * screening cannot catch someone describing a condition in ordinary words.
 * Putting that text in an email would copy it into whichever inbox the
 * pharmacy uses — typically a consumer mailbox with no BAA — which is the
 * least protected place it could land, and the one place it can never be
 * deleted from with any confidence. So this is a doorbell, not a delivery.
 */
export async function sendContactEmail(_data: ContactMessageInput): Promise<void> {
  const to = process.env.CONTACT_FORWARD_EMAIL || fromAddress;
  const adminUrl = `${process.env.APP_BASE_URL ?? "https://rxlibertypharmacy.com"}/admin/messages`;
  const subject = "New contact form message";
  const text =
    `A new message was submitted through the website contact form.\n\n` +
    `Open the admin panel to read and reply to it:\n${adminUrl}\n\n` +
    `Message details are not included in this email on purpose — they are ` +
    `kept encrypted in the patient portal rather than copied into an inbox.`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1b2a47;margin:0 0 12px">New contact form message</h2>
      <p style="color:#334155;font-size:15px;line-height:1.6">A new message was submitted through the website contact form.</p>
      <p style="text-align:center;padding:8px 0">
        <a href="${adminUrl}" style="display:inline-block;background:#1b2a47;color:#fff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px">Open admin panel</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:16px">
        Message details are not included in this email on purpose — they are kept
        encrypted in the patient portal rather than copied into an inbox.
      </p>
    </div>`;

  if (transporter && to) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy Website" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] Contact form notification (no transport configured):\n${text}\n`);
    return;
  }

  if (demoLogCodes) {
    // No code or link to surface here - the notification is deliberately
    // content-free (details stay encrypted in the admin panel), so this just
    // records that a submission arrived and where to read it.
    // `to` falls back to the transport's from address, which is itself unset
    // when no transport is configured - which is exactly this case.
    demoLog("contact notification", to ?? "(no recipient configured)", adminUrl);
    return;
  }

  throw new Error("Email transport not configured — cannot notify of contact form submissions in production.");
}
