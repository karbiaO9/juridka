const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendResetEmail = (to, resetLink) =>
  transporter.sendMail({
    from: `"Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1f2937;">Réinitialisation du mot de passe</h2>
        <p style="color:#4b5563;">Vous avez demandé une réinitialisation de votre mot de passe.</p>
        <p style="color:#4b5563;">Cliquez sur le bouton ci-dessous. Ce lien est valable <strong>24 heures</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;margin:24px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#9ca3af;font-size:12px;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.<br/>
          Le lien expirera automatiquement après 24 heures.
        </p>
      </div>
    `,
  });
const sendOtpEmail = (to, otp) =>
  transporter.sendMail({
    from: `"Juridika.tn" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Votre code de vérification',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1f2937;">Vérification de votre email</h2>
        <p style="color:#4b5563;">Voici votre code de vérification :</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#C9A84C;text-align:center;padding:24px 0;">
          ${otp}
        </div>
        <p style="color:#9ca3af;font-size:12px;">
          Ce code est valable <strong>10 minutes</strong>.<br/>
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </p>
      </div>
    `,
  });

module.exports = { transporter, sendResetEmail, sendOtpEmail };
