import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/logs - Get all activity logs (admin only)
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { action, user_name, date_from, date_to } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }
    if (user_name) {
      conditions.push(`LOWER(user_name) LIKE $${paramIndex++}`);
      params.push(`%${user_name.toLowerCase()}%`);
    }
    if (date_from) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(date_to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Error al obtener los registros' });
  }
});

// POST /api/logs - Create activity log (authenticated users)
router.post('/', authenticate, async (req, res) => {
  try {
    const { user_id, user_name, action, entity, entity_id, details } = req.body;

    if (!action || !details) {
      return res.status(400).json({ error: 'Los campos action y details son obligatorios' });
    }

    const result = await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, action, entity, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id || req.user.id, user_name || req.user.email, action, entity || null, entity_id || null, details]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// DELETE /api/logs/:id - Delete activity log (admin only)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM activity_logs WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error deleting activity log:', error);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

export default router;
