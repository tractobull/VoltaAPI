import { Router } from 'express';
import { ChatService } from '../services/chatService.js';
import pool from '../db/pool.js';

const router = Router();
const chatService = new ChatService();

// POST /api/chat - Send message (legacy, no streaming)
router.post('/', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Se requiere un mensaje' });
    }

    const result = await chatService.sendMessage(message, sessionId, userId);

    res.json({
      content: result.content,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('[Legacy Chat] Error:', error);
    res.status(500).json({ error: 'Error processing chat message' });
  }
});

// POST /api/chat/stream - Streaming con SSE
// Body: { message: string, history: {role, content}[], sessionId?: string, userId?: string }
router.post('/stream', async (req, res) => {
  try {
    const { message, history = [], sessionId, userId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Se requiere un mensaje' });
    }

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Helper para enviar eventos SSE
    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Preparar sesión y obtener mensajes completos desde DB
    const { sessionId: currentSessionId, chatMessages } = await chatService.prepareStream(
      message,
      sessionId,
      userId
    );

    // Emitir sessionId al cliente para que lo guarde
    sendEvent('session', { sessionId: currentSessionId });

    // Reintentar en caso de rate limit
    let retryCount = 0;
    const maxRetries = 5;
    let groqResponse;

    while (retryCount < maxRetries) {
      groqResponse = await fetch(chatService.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chatService.apiKey}`,
        },
        body: JSON.stringify({
          model: chatService.model,
          messages: chatMessages,
          temperature: 0,
          max_tokens: 512,
          stream: true,
        }),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text().catch(() => 'Unknown error');

        // Manejar rate limit
        if (groqResponse.status === 429) {
          try {
            const errorData = JSON.parse(errorText);
            const message = errorData.error?.message || '';
            // Manejar tanto segundos (s) como milisegundos (ms)
            const match = message.match(/Please try again in (\d+\.?\d*)(s|ms)/);
            if (match) {
              let retryAfter = parseFloat(match[1]);
              // Si está en milisegundos, convertir a segundos
              if (match[2] === 'ms') {
                retryAfter = retryAfter / 1000;
              }
              console.error(`[Stream] Rate limit, retrying after ${retryAfter}s (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              retryCount++;
              continue;
            }
          } catch (e) {
            // No es un error de rate limit parseable, lanzar error
            console.error('[Stream] Failed to parse rate limit error:', e);
            sendEvent('error', { message: `Groq error: ${groqResponse.status}` });
            res.end();
            return;
          }
        }

        // Otros errores no son reintentables
        sendEvent('error', { message: `Groq error: ${groqResponse.status}` });
        res.end();
        return;
      }

      break; // Éxito, salir del loop
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text().catch(() => 'Unknown error');
      sendEvent('error', { message: `Groq error: ${groqResponse.status}` });
      res.end();
      return;
    }

    // Consumir el stream de Groq y retransmitir al cliente
    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // La última línea puede estar incompleta

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            sendEvent('delta', { text: delta });
          }
        } catch {
          // Ignorar líneas que no son JSON válido
        }
      }
    }

    // Guardar respuesta completa en DB usando el servicio
    await chatService.saveStreamedMessage(currentSessionId, fullContent);

    // Señal de fin
    sendEvent('done', { sessionId: currentSessionId });
    res.end();

  } catch (error) {
    console.error('Error in stream chat:', error);
    // Si los headers ya se enviaron, usar SSE para el error
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Error interno del servidor' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
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
    res.status(500).json({ error: 'Error al obtener los mensajes del chat' });
  }
});

// DELETE /api/chat/:sessionId - Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
    res.json({ message: 'Sesión eliminada' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Error al eliminar la sesión' });
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