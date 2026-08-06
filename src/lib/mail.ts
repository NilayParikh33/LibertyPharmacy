import nodemailer from "nodemailer";

/**
 * Outbound email seam.
 *
 * Current transport: Gmail SMTP (free) — activates when GMAIL_USER and
 * GMAIL_APP_PASSWORD are set in .env.local. Suitable for the fake-data /
 * demo phase ONLY: consumer Gmail offers no BAA, so before real patients
 * enroll this must be swapped for a BAA-covered provider (AWS SES under the
 * AWS BAA is the plan — only the `send` internals below change).
 *
 * Without credentials, dev prints codes to the server console and production
 * refuses to send rather than failing silently.
 *
 * PHI note: OTP messages deliberately contain no health information — just a
 * code. Never add prescription, appointment, or medical content to any email
 * sent through a non-BAA transport.
 */

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

const transporter =
  gmailUser && gmailPass
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      })
    : null;

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
      from: `"Liberty Pharmacy" <${gmailUser}>`,
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

/**
 * Password reset link. The URL carries a single-use token, so the message is
 * sensitive: it is sent only to the address already on the account, and the
 * link expires in 30 minutes.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = "Reset your Liberty Pharmacy password";
  const intro = "We received a request to reset your Liberty Pharmacy password.";

  if (transporter) {
    await transporter.sendMail({
      from: `"Liberty Pharmacy" <${gmailUser}>`,
      to,
      subject,
      text: `${intro}\n\nOpen this link to choose a new password:\n${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you didn't request it, you can ignore this email — your password will not change.`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1b2a47;margin:0 0 16px">Liberty Pharmacy</h2>
          <p style="color:#334155;font-size:15px;line-height:1.6">${intro}</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#2f5592;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:8px">Choose a new password</a>
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.6">This link expires in 30 minutes and can only be used once. If you didn't request it, you can safely ignore this email — your password will not change.</p>
          <p style="color:#94a3b8;font-size:12px;line-height:1.6;word-break:break-all">If the button doesn't work, paste this into your browser:<br>${resetUrl}</p>
        </div>`,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] Reset link: ${resetUrl}\n`);
    return;
  }

  throw new Error("Email transport not configured — cannot send password reset emails in production.");
}
