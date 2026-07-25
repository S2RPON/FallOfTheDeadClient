import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const emailFrom = process.env.EMAIL_FROM || 'Fall Of The Dead Support <FallOfTheDeadSupport@gmail.com>';

export async function sendVerificationEmail({ email, displayName, token }) {
  const html = `
    <div style="background:#0a0a0c;color:#f5f5f7;font-family:sans-serif;padding:24px;border-radius:12px;max-width:560px;margin:auto">
      <h1 style="margin-top:0">Fall Of The Dead</h1>
      <p>Hello ${displayName || email},</p>
      <p>Your verification code is:</p>
      <h2 style="letter-spacing:4px">${token}</h2>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border-color:#27272f"/>
      <p style="color:#9d9da3;font-size:12px">Fall Of The Dead Support &copy; 2026</p>
    </div>
  `;

  await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: 'Verify your email - Fall Of The Dead',
    html
  });
}

export { transporter };
