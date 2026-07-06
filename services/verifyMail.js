const nodemailer = require('nodemailer');

// Mail configuration from .env
const EMAIL_USER = process.env.MAIL_USERNAME;
const EMAIL_PASS = process.env.MAIL_PASSWORD;
const SMTP_HOST = process.env.MAIL_HOST;
const SMTP_PORT = process.env.MAIL_PORT;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT, 10),
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

transporter.verify((err, success) => {
  if (err) {
    console.error(err);
  } else {
    console.log('SMTP ready');
  }
});

async function sendMailVerifyEmail(user, verificationUrl) {
  if (!SMTP_HOST || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Mail is not configured. Set MAIL_HOST, MAIL_USERNAME, and MAIL_PASSWORD in .env');
  }

  const mailOptions = {
    from: `"Support Team" <${EMAIL_USER}>`,
    to: user.email,
    subject: 'Verify your email',
    html: `
      <p>Hello ${user.name},</p>
      <p>Thank you for signing up. Please verify your email by clicking the link below:</p>
      <p><a href="${verificationUrl}">Verify email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>Regards,<br>Support Team</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Verification email sent:', info.messageId);
  return info;
}

module.exports = sendMailVerifyEmail;
