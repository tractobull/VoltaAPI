import { Router } from 'express';
import { ChatService } from '../services/chatService.js';
import pool from '../db/pool.js';

const router = Router();
const chatService = new ChatService();

// POST /api/chat - Send message (legacy, no streaming)
router.post('/', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('[Legacy Chat] Request:', { message, sessionId });

    const messages = [{ role: 'user', content: message }];
    const result = await chatService.sendMessage(messages, sessionId);

    console.log('[Legacy Chat] Response:', { contentLength: result.content?.length, sessionId: result.sessionId });

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

    console.log('[Stream] Request received:', { message, sessionId, userId, historyLength: history.length });

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
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

    console.log('[Stream] Preparing stream...');
    // Preparar sesión y obtener mensajes completos desde DB
    const { sessionId: currentSessionId, chatMessages } = await chatService.prepareStream(
      message,
      sessionId,
      userId
    );

    console.log('[Stream] Session prepared:', { currentSessionId, messagesCount: chatMessages.length });

    // Emitir sessionId al cliente para que lo guarde
    sendEvent('session', { sessionId: currentSessionId });

    console.log('[Stream] Calling Groq API...');

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

    console.log('[Stream] Groq response status:', groqResponse.status);

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text().catch(() => 'Unknown error');
      sendEvent('error', { message: `Groq error: ${groqResponse.status}` });
      console.error('[Stream] Groq API error:', errorText);
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
      res.status(500).json({ error: 'Error processing stream' });
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