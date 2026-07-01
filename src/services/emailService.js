import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('EmailService: SMTP no configurado. Los correos no se enviarán.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function getFromAddress() {
  return process.env.FROM_ADDRESS || '"Volta" <noreply@volta.com.mx>';
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.error('EmailService: SMTP no configurado, no se pudo enviar correo a', to);
    return { ok: false, error: 'SMTP no configurado' };
  }

  if (!to || !subject || (!html && !text)) {
    return { ok: false, error: 'Faltan parámetros requeridos (to, subject, html o text)' };
  }

  try {
    const info = await t.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });

    console.log(`EmailService: Correo enviado a ${to} (id: ${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('EmailService: Error enviando correo:', err);
    return { ok: false, error: 'Error al enviar el correo' };
  }
}
