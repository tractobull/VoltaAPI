import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  canAgentManageSupportChat,
  emitSupportMessage,
  emitSupportMessageDeleted,
  emitSupportMessagesRead,
  emitSupportReply,
  emitSupportStatus,
  getSupportChatPresence,
} from '../websocket/index.js';

const router = Router();

async function requireSupportEnabled(req, res, next) {
  try {
    const result = await pool.query('SELECT enabled FROM support_settings WHERE id = 1');
    if (result.rows[0]?.enabled === false) {
      return res.status(503).json({
        code: 'SUPPORT_DISABLED',
        error: 'Los agentes de soporte no se encuentran disponibles en este momento',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

// GET /api/support/enabled - Check if support is enabled
router.get('/enabled', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT enabled, updated_at
       FROM support_settings
       WHERE id = 1`
    );
    res.json(result.rows[0] || { enabled: true, updated_at: null });
  } catch (error) {
    console.error('Error fetching support availability:', error);
    res.status(500).json({ error: 'Error al consultar la disponibilidad del soporte' });
  }
});

// PUT /api/support/enabled - Update support availability (admin only)
router.put('/enabled', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'El estado enabled debe ser booleano' });
    }

    // Prevent disabling if there are active agents attending conversations
    if (!enabled) {
      const presence = getSupportChatPresence();
      const activeAgents = Object.values(presence).length;
      if (activeAgents > 0) {
        return res.status(400).json({ 
          error: `No se puede desactivar el chat porque hay ${activeAgents} agente${activeAgents > 1 ? 's' : ''} atendiendo conversaciones activas` 
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO support_settings (id, enabled, updated_by, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
       RETURNING enabled, updated_at`,
      [enabled, req.user.id]
    );

    emitSupportStatus(enabled);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating support availability:', error);
    res.status(500).json({ error: 'Error al actualizar la disponibilidad del soporte' });
  }
});

// POST /api/support/messages - Send a support message
router.post('/messages', authenticate, requireSupportEnabled, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO support_messages (user_id, message, is_from_user, is_read)
         VALUES ($1, $2, true, false)
         RETURNING *
       )
       SELECT inserted.*, u.name AS user_name, u.email AS user_email
       FROM inserted
       JOIN users u ON u.id = inserted.user_id`,
      [userId, message.trim()]
    );

    // Emit to websocket
    emitSupportMessage(userId, result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
});

// GET /api/support/messages - Get support messages for current user
router.get('/messages', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const readResult = await pool.query(
      `UPDATE support_messages
       SET is_read = true, updated_at = NOW()
       WHERE user_id = $1 AND is_from_user = false AND is_read = false
       RETURNING id`,
      [userId]
    );

    const result = await pool.query(
      `SELECT sm.*, agent.name AS agent_name
       FROM support_messages sm
       LEFT JOIN users agent ON agent.id = sm.sender_agent_id
       WHERE sm.user_id = $1
       ORDER BY sm.created_at ASC`,
      [userId]
    );

    emitSupportMessagesRead(userId, readResult.rows.map((row) => row.id), 'customer');

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching support messages:', error);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

// GET /api/support/chats - Get all support chats (admin only)
router.get('/chats', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         sm.user_id,
         u.name as user_name,
         u.email as user_email,
         COUNT(sm.id) as message_count,
         COUNT(CASE WHEN sm.is_from_user = true AND sm.is_read = false THEN 1 END) as unread_count,
         MAX(sm.created_at) as last_message_at,
         (SELECT message FROM support_messages 
          WHERE user_id = sm.user_id 
          ORDER BY created_at DESC 
          LIMIT 1) as last_message,
         (SELECT is_from_user FROM support_messages 
          WHERE user_id = sm.user_id 
          ORDER BY created_at DESC 
          LIMIT 1) as last_message_from_user
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       GROUP BY sm.user_id, u.name, u.email
       ORDER BY last_message_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching support chats:', error);
    res.status(500).json({ error: 'Error al obtener los chats' });
  }
});

// GET /api/support/users/:userId/context - Customer context for support agents
router.get('/users/:userId/context', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId } = req.params;
    const [userResult, summaryResult, ordersResult, addressesResult, vehiclesResult] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, points, created_at
         FROM users
         WHERE id = $1 AND role = 'CUSTOMER'`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_orders,
                COALESCE(SUM(total) FILTER (WHERE status != 'CANCELLED'), 0)::numeric AS total_spent,
                MAX(created_at) AS last_order_at
         FROM orders
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT o.id, o.status, o.total, o.shipping_cost, o.points_discount, o.created_at,
                w.name AS warehouse_name,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'name', COALESCE(oi.snapshot->>'name', p.name),
                      'quantity', oi.quantity,
                      'price', oi.price
                    ) ORDER BY oi.id
                  ) FILTER (WHERE oi.id IS NOT NULL),
                  '[]'::json
                ) AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN warehouses w ON w.id = o.warehouse_id
         WHERE o.user_id = $1
         GROUP BY o.id, w.name
         ORDER BY o.created_at DESC
         LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT id, label, street, number, colony, city, state, zip_code, is_default
         FROM addresses
         WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, brand, model, year, engine, plate
         FROM vehicles
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      user: userResult.rows[0],
      summary: summaryResult.rows[0],
      orders: ordersResult.rows,
      addresses: addressesResult.rows,
      vehicles: vehiclesResult.rows,
    });
  } catch (error) {
    console.error('Error fetching support customer context:', error);
    res.status(500).json({ error: 'Error al obtener el contexto del usuario' });
  }
});

// GET /api/support/messages/:userId - Get messages for specific user (admin only)
router.get('/messages/:userId', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId } = req.params;

    const readResult = await pool.query(
      `UPDATE support_messages
       SET is_read = true, updated_at = NOW()
       WHERE user_id = $1 AND is_from_user = true AND is_read = false
       RETURNING id`,
      [userId]
    );

    const result = await pool.query(
      `SELECT sm.*, agent.name AS agent_name
       FROM support_messages sm
       LEFT JOIN users agent ON agent.id = sm.sender_agent_id
       WHERE sm.user_id = $1
       ORDER BY sm.created_at ASC`,
      [userId]
    );

    emitSupportMessagesRead(userId, readResult.rows.map((row) => row.id), 'agent');

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user support messages:', error);
    res.status(500).json({ error: 'Error al obtener los mensajes del usuario' });
  }
});

// POST /api/support/messages/:userId/reply - Reply to user (admin only)
router.post('/messages/:userId/reply', authenticate, authorize('ADMIN', 'SUPPORT'), requireSupportEnabled, async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    if (!canAgentManageSupportChat(userId, req.user.id)) {
      const presence = getSupportChatPresence(userId);
      return res.status(409).json({
        code: 'CHAT_OCCUPIED',
        error: `${presence?.agent?.name || 'Otro agente'} ya está atendiendo esta conversación`,
        presence,
      });
    }

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO support_messages (user_id, sender_agent_id, message, is_from_user, is_read)
         VALUES ($1, $2, $3, false, false)
         RETURNING *
       )
       SELECT inserted.*, u.name AS user_name, u.email AS user_email,
              agent.name AS agent_name
       FROM inserted
       JOIN users u ON u.id = inserted.user_id
       JOIN users agent ON agent.id = inserted.sender_agent_id`,
      [userId, req.user.id, message.trim()]
    );

    // Emit to websocket
    emitSupportReply(userId, result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending support reply:', error);
    res.status(500).json({ error: 'Error al enviar la respuesta' });
  }
});

// DELETE /api/support/messages/:id - Delete an agent's own message
router.delete('/messages/:id', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM support_messages
       WHERE id = $1
         AND is_from_user = false
         AND sender_agent_id = $2
       RETURNING id, user_id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Solo puedes eliminar mensajes enviados por ti' });
    }

    const deleted = result.rows[0];
    emitSupportMessageDeleted(deleted.user_id, deleted.id);
    res.json({ id: deleted.id, userId: deleted.user_id });
  } catch (error) {
    console.error('Error deleting support message:', error);
    res.status(500).json({ error: 'Error al eliminar el mensaje' });
  }
});

// PUT /api/support/messages/:id/read - Mark message as read
router.put('/messages/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAgent = ['ADMIN', 'SUPPORT'].includes(req.user.role);

    const result = await pool.query(
      `UPDATE support_messages
       SET is_read = true, updated_at = NOW()
       WHERE id = $1
         AND is_read = false
         AND (
           ($3::boolean = true AND is_from_user = true)
           OR
           ($3::boolean = false AND user_id = $2 AND is_from_user = false)
         )
       RETURNING *`,
      [id, userId, isAgent]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query(
        `SELECT * FROM support_messages
         WHERE id = $1
           AND (
             ($3::boolean = true AND is_from_user = true)
             OR
             ($3::boolean = false AND user_id = $2 AND is_from_user = false)
           )`,
        [id, userId, isAgent]
      );
      if (existing.rows.length > 0) return res.json(existing.rows[0]);
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const message = result.rows[0];
    emitSupportMessagesRead(
      message.user_id,
      [message.id],
      isAgent ? 'agent' : 'customer'
    );
    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Error al marcar el mensaje como leído' });
  }
});

// GET /api/support/unread-count - Get unread message count for current user
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM support_messages
       WHERE user_id = $1 AND is_from_user = false AND is_read = false`,
      [userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Error al obtener el contador de mensajes no leídos' });
  }
});

export default router;
