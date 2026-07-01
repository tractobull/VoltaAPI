import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  canAgentManageSupportChat,
  emitSupportMessage,
  emitSupportMessageDeleted,
  emitSupportMessagesRead,
  emitSupportBlockChanged,
  emitSupportReply,
  emitSupportStatus,
  getSupportChatPresence,
} from '../websocket/index.js';
import { ModerationService } from '../services/moderation/ModerationService.js';

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

    // Check if user is blocked from support
    const blockCheck = await pool.query(
      `SELECT * FROM support_blocks WHERE user_id = $1 AND unblocked_at IS NULL`,
      [userId]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(403).json({
        code: 'USER_BLOCKED',
        error: 'Has sido bloqueado de soporte. No puedes enviar mensajes.',
      });
    }

    // Analyze message for moderation
    const moderation = ModerationService.analyze(message);

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO support_messages (user_id, message, is_from_user, is_read, moderation_score, moderation_severity, moderation_categories, moderation_flags, moderation_priority, sentiment, suggested_queue)
         VALUES ($1, $2, true, false, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *
       )
       SELECT inserted.*, u.name AS user_name, u.email AS user_email
       FROM inserted
       JOIN users u ON u.id = inserted.user_id`,
      [userId, message.trim(), moderation.score, moderation.severity, moderation.categories, moderation.flags, moderation.priority, moderation.sentiment, moderation.suggestedQueue]
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
          LIMIT 1) as last_message_from_user,
         (SELECT sentiment FROM support_messages
          WHERE user_id = sm.user_id
          ORDER BY created_at DESC
          LIMIT 1) as sentiment,
         (SELECT suggested_queue FROM support_messages
          WHERE user_id = sm.user_id
          ORDER BY created_at DESC
          LIMIT 1) as suggested_queue,
         MAX(sm.moderation_score) as max_moderation_score,
         CASE MAX(CASE sm.moderation_severity
           WHEN 'CRITICAL' THEN 3
           WHEN 'HIGH' THEN 2
           WHEN 'MEDIUM' THEN 1
           ELSE 0
         END)
           WHEN 3 THEN 'CRITICAL'
           WHEN 2 THEN 'HIGH'
           WHEN 1 THEN 'MEDIUM'
           ELSE 'LOW'
         END as max_moderation_severity,
         BOOL_OR(sm.moderation_priority) as has_priority,
         (SELECT ARRAY_AGG(DISTINCT cat)
          FROM (SELECT UNNEST(sm2.moderation_categories) as cat
                FROM support_messages sm2
                WHERE sm2.user_id = sm.user_id
                  AND sm2.moderation_categories IS NOT NULL
                  AND array_length(sm2.moderation_categories, 1) > 0) sub
          WHERE cat IS NOT NULL) as all_categories
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       GROUP BY sm.user_id, u.name, u.email
       ORDER BY has_priority DESC, unread_count DESC, last_message_at DESC`
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

    // Check if user is blocked from support
    const blockCheck = await pool.query(
      `SELECT * FROM support_blocks WHERE user_id = $1 AND unblocked_at IS NULL`,
      [userId]
    );
    if (blockCheck.rows.length > 0) {
      return res.status(403).json({
        code: 'USER_BLOCKED',
        error: 'Este usuario ha sido bloqueado de soporte',
        block: blockCheck.rows[0],
      });
    }

    // Analyze message for moderation
    const moderation = ModerationService.analyze(message);

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO support_messages (user_id, sender_agent_id, message, is_from_user, is_read, moderation_score, moderation_severity, moderation_categories, moderation_flags, moderation_priority, sentiment, suggested_queue)
         VALUES ($1, $2, $3, false, false, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *
       )
       SELECT inserted.*, u.name AS user_name, u.email AS user_email,
              agent.name AS agent_name
       FROM inserted
       JOIN users u ON u.id = inserted.user_id
       JOIN users agent ON agent.id = inserted.sender_agent_id`,
      [userId, req.user.id, message.trim(), moderation.score, moderation.severity, moderation.categories, moderation.flags, moderation.priority, moderation.sentiment, moderation.suggestedQueue]
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

// POST /api/support/check-warning - Check if message should trigger warning
router.post('/check-warning', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const warningCheck = ModerationService.checkWarning(message);

    res.json(warningCheck);
  } catch (error) {
    console.error('Error checking message warning:', error);
    res.status(500).json({ error: 'Error al verificar el mensaje' });
  }
});

// POST /api/support/check-warning-user - Check if message should trigger warn for the user
router.post('/check-warning-user', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const warningCheck = ModerationService.checkWarningUser(message);

    res.json(warningCheck);
  } catch (error) {
    console.error('Error checking message warning:', error);
    res.status(500).json({ error: 'Error al verificar el mensaje' });
  }
});

// POST /api/support/ai-advise - Get AI advice about a conversation
router.post('/ai-advise', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId, messages: rawMessages } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    let messages;
    if (rawMessages && Array.isArray(rawMessages) && rawMessages.length > 0) {
      messages = rawMessages;
    } else {
      const result = await pool.query(
        `SELECT sm.*, u.name as user_name, u.email as user_email, agent.name as agent_name
         FROM support_messages sm
         JOIN users u ON u.id = sm.user_id
         LEFT JOIN users agent ON agent.id = sm.sender_agent_id
         WHERE sm.user_id = $1
         ORDER BY sm.created_at ASC`,
        [userId]
      );
      messages = result.rows;
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No hay mensajes en esta conversación' });
    }

    const recentMessages = messages.length > 20 ? messages.slice(-20) : messages;

    const conversationText = recentMessages.map((msg) => {
      const sender = msg.is_from_user ? (msg.user_name || 'Cliente') : (msg.agent_name || 'Agente');
      const time = new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      let label = `[${time}] ${sender}: ${msg.message}`;
      const sev = msg.moderation_severity;
      const cats = msg.moderation_categories;
      if (sev && sev !== 'LOW' && cats?.length) {
        label += ` [MOD: ${sev} - ${cats.join(', ')}]`;
      }
      return label;
    }).join('\n');

    const categories = [...new Set(recentMessages.flatMap((msg) => msg.moderation_categories || []))];
    const SEVERITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    const maxSeverity = messages.reduce((highest, m) =>
      SEVERITY_RANK[m.moderation_severity] > SEVERITY_RANK[highest] ? m.moderation_severity : highest
    , 'LOW');
    const maxScore = Math.max(...messages.map((m) => Number(m.moderation_score) || 0));
    const sentiment = recentMessages[recentMessages.length - 1]?.sentiment || 'NEUTRAL';

    const agentMessages = recentMessages.filter(m => !m.is_from_user);

    const systemPrompt = `Eres un asesor de soporte para Volta, autopartes para camiones.

INSTRUCCIÓN #1 (prioridad máxima): Revisa el último mensaje del cliente. Si comprueba que recibió su pedido o que el problema se resolvió, tu ANÁLISIS debe decirlo, tu RECOMENDACIÓN debe ser cerrar o preguntar si necesita algo más, y tu RESPUESTA SUGERIDA debe ser de cierre profesional y neutral. NO uses tono alegre ("excelente", "me alegra") si la conversación fue tensa o severa. Sé cordial pero serio.

INSTRUCCIÓN #2: Si algún mensaje del AGENTE contiene insultos ("malnacido", "puto", "naco", "estúpido", "inútil") o tiene [MOD: HIGH/CRITICAL/INSULT/HATE/THREAT], el agente insultó al cliente. En ese caso: (a) ANÁLISIS debe decirlo explícitamente ("el agente también insultó al cliente"), (b) RECOMENDACIÓN debe priorizar que el agente se disculpe por SU conducta, (c) la RESPUESTA SUGERIDA debe centrarse en disculpar el insulto del agente, no en el servicio. No ignores los insultos del agente aunque el cliente también haya insultado.

INSTRUCCIÓN #3: No inventes ofertas (reembolsos, descuentos, compensaciones). Di "revisar opciones" o "escalar".

INSTRUCCIÓN #4: NUNCA uses la frase "Lo siento mucho, Cesar. Me doy cuenta de que el servicio que recibió fue inaceptable y me disculpo por el trato inadecuado" ni variaciones. Esa frase está prohibida. Tu RESPUESTA SUGERIDA debe ser original y reflejar el mensaje CONCRETO que el agente necesita enviar ahora.

Contexto: Severidad ${maxSeverity} | Score ${maxScore}/100 | Categorías: ${categories.join(', ') || 'Ninguna'} | Total: ${messages.length} msgs

Últimas respuestas del agente (avanza desde aquí, no repitas):
${agentMessages.slice(-3).map(m => `- "${m.message}"`).join('\n')}

Conversación:
${conversationText}

Escribe SOLO esto (sin notas extra):
ANÁLISIS:
RECOMENDACIÓN:
RESPUESTA SUGERIDA:`

    const apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    const apiKey = process.env.GROQ_API_KEY || '';
    const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No se pudo generar una recomendación.';

    res.json({
      advice: content,
      metadata: {
        messageCount: messages.length,
        recentCount: recentMessages.length,
        severity: maxSeverity,
        score: maxScore,
        categories,
        sentiment,
      },
    });
  } catch (error) {
    console.error('Error getting AI advice:', error);
    res.status(500).json({ error: 'Error al obtener recomendación de IA' });
  }
});

// POST /api/support/block - Block a user from support
router.post('/block', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }
    const blockReason = reason?.trim() || 'Comportamiento inadecuado';

    const existing = await pool.query(
      `SELECT * FROM support_blocks WHERE user_id = $1 AND unblocked_at IS NULL`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El usuario ya está bloqueado', block: existing.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO support_blocks (user_id, blocked_by, reason) VALUES ($1, $2, $3) RETURNING *`,
      [userId, req.user.id, blockReason]
    );

    emitSupportBlockChanged(userId, true, blockReason);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Error al bloquear usuario' });
  }
});

// POST /api/support/unblock - Unblock a user from support
router.post('/unblock', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const result = await pool.query(
      `UPDATE support_blocks
       SET unblocked_at = NOW(), unblocked_by = $2, unblock_reason = $3
       WHERE user_id = $1 AND unblocked_at IS NULL
       RETURNING *`,
      [userId, req.user.id, reason || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'El usuario no está bloqueado' });
    }

    emitSupportBlockChanged(userId, false, reason || null);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Error al desbloquear usuario' });
  }
});

// GET /api/support/block-status/:userId - Check if user is blocked
router.get('/block-status/:userId', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT sb.*, blocker.name AS blocked_by_name, unblocker.name AS unblocked_by_name
       FROM support_blocks sb
       LEFT JOIN users blocker ON blocker.id = sb.blocked_by
       LEFT JOIN users unblocker ON unblocker.id = sb.unblocked_by
       WHERE sb.user_id = $1
       ORDER BY sb.created_at DESC`,
      [userId]
    );

    const active = result.rows.find(r => !r.unblocked_at) || null;
    res.json({ active, history: result.rows });
  } catch (error) {
    console.error('Error checking block status:', error);
    res.status(500).json({ error: 'Error al verificar estado de bloqueo' });
  }
});

// GET /api/support/blocked - Check if current user is blocked (user-facing)
router.get('/blocked', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reason, created_at FROM support_blocks WHERE user_id = $1 AND unblocked_at IS NULL`,
      [req.user.id]
    );
    res.json({ blocked: result.rows.length > 0, block: result.rows[0] || null });
  } catch (error) {
    console.error('Error checking block status:', error);
    res.status(500).json({ error: 'Error al verificar estado de bloqueo' });
  }
});

// POST /api/support/appeal - User appeals their support block
router.post('/appeal', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'El motivo de apelación es requerido' });
    }

    const activeBlock = await pool.query(
      `SELECT * FROM support_blocks WHERE user_id = $1 AND unblocked_at IS NULL`,
      [req.user.id]
    );

    if (activeBlock.rows.length === 0) {
      return res.status(404).json({ error: 'No tienes un bloqueo activo' });
    }

    const result = await pool.query(
      `UPDATE support_blocks
       SET appeal_text = $1, appealed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason.trim(), activeBlock.rows[0].id]
    );

    emitSupportBlockChanged(req.user.id, true, activeBlock.rows[0].reason);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error recording appeal:', error);
    res.status(500).json({ error: 'Error al registrar apelación' });
  }
});

// POST /api/support/moderation-feedback - Record agent action on moderation findings
router.post('/moderation-feedback', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { userId, action, categories } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }
    if (!action || !['dismissed', 'false_positive'].includes(action)) {
      return res.status(400).json({ error: 'action debe ser "dismissed" o "false_positive"' });
    }

    const result = await pool.query(
      `INSERT INTO support_moderation_feedback (user_id, agent_id, action, categories)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, req.user.id, action, categories || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error recording moderation feedback:', error);
    res.status(500).json({ error: 'Error al registrar retroalimentación de moderación' });
  }
});

export default router;
