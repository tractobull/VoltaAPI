import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications - Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error al obtener las notificaciones' });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int as count FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [req.user.id]
    );
    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Error al obtener el contador de no leídas' });
  }
});

// PUT /api/notifications/:id/read - Mark one as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Error al marcar la notificación como leída' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET read = TRUE
       WHERE user_id = $1 AND read = FALSE`,
      [req.user.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error('Error marking all read:', error);
    res.status(500).json({ error: 'Error al marcar todas como leídas' });
  }
});

// POST /api/notifications - Create notification (internal use)
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId, type, title, description, icon, data } = req.body;
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, description, icon, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, description, icon || 'bell', data ? JSON.stringify(data) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Error al crear la notificación' });
  }
});

export default router;
