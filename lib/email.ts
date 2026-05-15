import nodemailer from "nodemailer"

function makeTransport() {
  const host = process.env.SMTP_HOST
  if (!host) return null                          // dev fallback: log to console

  return nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

interface SendOptions {
  to:      string
  subject: string
  html:    string
}

export async function sendEmail({ to, subject, html }: SendOptions) {
  const transport = makeTransport()

  if (!transport) {
    // No SMTP configured — print to server console so devs can grab the link
    console.log(`\n─── [trackR email] ───────────────────────────`)
    console.log(`To:      ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body:    (HTML — extract link from template)`)
    const linkMatch = html.match(/href="([^"]+)"/)
    if (linkMatch) console.log(`Link:    ${linkMatch[1]}`)
    console.log(`──────────────────────────────────────────────\n`)
    return
  }

  await transport.sendMail({
    from:    process.env.SMTP_FROM ?? "trackR <noreply@trackr.dev>",
    to,
    subject,
    html,
  })
}

export function inviteEmailHtml(name: string, inviteUrl: string) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0c0c0f;color:#f0f0f5;padding:40px 0;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#141418;border:1px solid #242429;border-radius:12px;overflow:hidden">
    <div style="background:#f59e0b;padding:20px 32px">
      <p style="margin:0;font-family:monospace;font-size:20px;font-weight:700;color:#000">
        track<span style="color:#78350f">R</span>
      </p>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#f0f0f5">You're invited, ${name}!</h2>
      <p style="color:#7a7a8a;margin:0 0 24px;line-height:1.6">
        You've been added to trackR, the employee time tracking system.
        Click below to set up your account.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#f59e0b;color:#000;font-weight:600;
                padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
        Accept Invite →
      </a>
      <p style="color:#3d3d4a;font-size:12px;margin:24px 0 0;line-height:1.6">
        This link expires in 48 hours. If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`
}
