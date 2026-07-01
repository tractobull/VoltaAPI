import { Router } from 'express';
import { sendEmail } from '../services/emailService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// POST /api/email/send - Send an email (requires auth, ADMIN or SUPPORT)
router.post('/send', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (to, subject, html o text)' });
    }

    const result = await sendEmail({ to, subject, html, text });

    if (!result.ok) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in email route:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
