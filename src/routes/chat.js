import { Router } from 'express';
import { ChatService } from '../services/chatService.js';
import pool from '../db/pool.js';

const router = Router();
const chatService = new ChatService();

// POST /api/chat - Send message
router.post('/', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const messages = [{ role: 'user', content: message }];
    const result = await chatService.sendMessage(messages, sessionId);

    res.json({
      content: result.content,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Error processing chat message' });
  }
});

// GET /api/chat/:sessionId - Get session messages
router.get('/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const messages = await chatService.getSessionMessages(sessionId);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Error fetching chat messages' });
  }
});

// DELETE /api/chat/:sessionId - Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Error deleting session' });
  }
});

// GET /api/chat/suggested/prompts - Get suggested prompts
router.get('/suggested/prompts', (req, res) => {
  const prompts = [
    'Mi camión frena mal, ¿qué necesito?',
    'Filtro de aceite para Freightliner Cascadia',
    '¿Cómo funcionan los puntos Volta?',
    '¿Tienen alternadores para Kenworth?',
    '¿Cuánto cuesta el envío a domicilio?',
    '¿Puedo recoger en tienda?',
    '¿Qué métodos de pago aceptan?',
    'Pastillas de freno para Peterbilt 579',
  ];
  res.json({ prompts });
});

export default router;
