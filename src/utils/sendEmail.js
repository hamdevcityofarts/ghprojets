const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

/**
 * 🔹 Fonction utilitaire pour l'envoi d'emails.
 * Utilisée pour envoyer :
 *  - la preuve de paiement au client
 *  - les confirmations / annulations de réservation
 */

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true si port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🔹 Envoi d'un email
module.exports = async function sendEmail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });

    console.log('📧 Email envoyé :', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi de l’email :', error.message);
  }
};
