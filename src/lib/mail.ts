import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

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
 * and production refuses to send rather than failing silently.
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
 * Where patient replies should land.
 *
 * Mail is sent from a no-reply address on the pharmacy's own domain, because
 * a domain identity is what lets DKIM align and keeps login codes out of spam.
 * That domain has no mailbox, though, so without this a patient who hits
 * reply — and some will, asking a question — would have their message vanish
 * silently. MAIL_REPLY_TO points at an inbox a person actually reads.
 *
 * Note for whoever monitors it: replies may contain health information, so
 * that inbox is subject to the same BAA requirement as any other channel
 * carrying PHI.
 */
const replyToAddress = process.env.MAIL_REPLY_TO;

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
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      to,
      subject,
      text: `${intro}\n\n${code}\n\nThis code expires in 10 minutes. If you didn't request it, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">${intro}</p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1b2a47;text-align:center;background:#f1f5f9;border-radius:8px;padding:16px 0">${code}</p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Dev-only fallback: surface the code in the terminal running `npm run dev`.
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] Code: ${code}\n`);
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
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      to,
      subject,
      text: `A password reset was requested for your Liberty Pharmacy account.\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request it, you can ignore this email — your password won't change.`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">A password reset was requested for your account. Click below to choose a new password:</p>
          <p style="text-align:center;padding:8px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#1b2a47;color:#fff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px">Reset password</a>
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">This link expires in 30 minutes. If you didn't request it, you can safely ignore this email — your password won't change.</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] Reset link: ${resetUrl}\n`);
    return;
  }

  throw new Error("Email transport not configured — cannot send password reset links in production.");
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
 * Forwards a general-inquiry contact-form submission to the pharmacy inbox.
 * Same transport as OTP mail (SES when configured, Gmail only pre-production)
 * — safe even on the non-BAA fallback because src/app/api/contact/route.ts
 * already screens out anything that looks like PHI before this is ever called.
 */
export async function sendContactEmail(data: ContactMessageInput): Promise<void> {
  const to = process.env.CONTACT_FORWARD_EMAIL || fromAddress;
  const subject = `Contact form: ${data.subject} — ${data.firstName} ${data.lastName}`;
  const text = `New contact form submission\n\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nPhone: ${data.phone || "(not provided)"}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#1b2a47;margin:0 0 16px">New contact form submission</h2>
      <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
      <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Email:</strong> ${data.email}</p>
      <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Phone:</strong> ${data.phone || "(not provided)"}</p>
      <p style="color:#334155;font-size:14px;margin:4px 0"><strong>Subject:</strong> ${data.subject}</p>
      <p style="color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;margin-top:16px;background:#f1f5f9;border-radius:8px;padding:12px">${data.message}</p>
    </div>`;

  if (transporter && to) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy Website" <${fromAddress}>`,
      to,
      replyTo: data.email,
      subject,
      text,
      html,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] Contact form submission (no transport configured):\n${text}\n`);
    return;
  }

  throw new Error("Email transport not configured — cannot forward contact form submissions in production.");
}
