import pool from '../db/pool.js';
import { IntentDetector } from '../chatbot/IntentDetector.js';
import { ContextBuilder } from '../chatbot/ContextBuilder.js';
import { PromptBuilder } from '../chatbot/PromptBuilder.js';
import { CatalogFormatter } from '../chatbot/CatalogFormatter.js';
import { ConversationSummarizer } from '../chatbot/ConversationSummarizer.js';

export class ChatService {
  constructor() {
    this.apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  static SYNONYMS = {
    'pastillas': ['freno', 'frenos', 'pastilla'],
    'zapatas': ['freno', 'frenos', 'zapata', 'zapatas'],
    'disco': ['freno', 'frenos', 'disco'],
    'discos': ['freno', 'frenos', 'disco', 'discos'],
    'freno': ['freno', 'frenos', 'pastilla', 'zapata', 'disco', 'cable'],
    'frenos': ['freno', 'frenos', 'pastilla', 'zapata', 'disco', 'cable'],
    'aceite': ['aceite', 'filtro', 'lubricante'],
    'filtro': ['filtro', 'filtros'],
    'filtros': ['filtro', 'filtros'],
    'bujia': ['bujia', 'bujias', 'encendido'],
    'bujias': ['bujia', 'bujias', 'encendido'],
    'amortiguador': ['amortiguador', 'suspension'],
    'amortiguadores': ['amortiguador', 'suspension'],
    'embrague': ['embrague', 'transmision'],
    'alternador': ['alternador', 'electrico', 'electricidad'],
    'arrancador': ['arrancador', 'electrico', 'starter'],
    'sensor': ['sensor', 'sensors', 'electrico'],
    'cable': ['cable', 'cables', 'freno', 'electrico'],
    'cables': ['cable', 'cables', 'freno', 'electrico'],
    'inyector': ['inyector', 'inyectores', 'combustible', 'motor'],
    'inyectores': ['inyector', 'inyectores', 'combustible', 'motor'],
    'bomba': ['bomba', 'hidraulico', 'combustible'],
    'bomba de agua': ['bomba', 'agua', 'motor'],
    'bomba hidraulica': ['bomba', 'hidraulico'],
    'valvula': ['valvula', 'motor'],
    'valvulas': ['valvula', 'motor'],
    'piston': ['piston', 'pistones', 'motor'],
    'pistones': ['piston', 'pistones', 'motor'],
    'junta': ['junta', 'juntas', 'motor'],
    'juntas': ['junta', 'juntas', 'motor'],
    'correa': ['correa', 'correas', 'motor'],
    'correas': ['correa', 'correas', 'motor'],
    'rodamiento': ['rodamiento', 'rodamientos', 'suspension'],
    'rodamientos': ['rodamiento', 'rodamientos'],
    'resorte': ['resorte', 'resortes', 'suspension'],
    'resortes': ['resorte', 'resortes', 'suspension'],
    'brazo': ['brazo', 'brazos', 'suspension'],
    'brazos': ['brazo', 'brazos', 'suspension'],
    'buje': ['buje', 'bujes', 'suspension'],
    'bujes': ['buje', 'bujes', 'suspension'],
    'bomba de aire': ['aire', 'bomba', 'freno'],
    'llanta': ['llanta', 'llantas', 'rin', 'rines'],
    'llantas': ['llanta', 'llantas', 'rin', 'rines'],
    'rin': ['rin', 'rines', 'llanta'],
    'rines': ['rin', 'rines', 'llanta'],
    'motor': ['motor', 'mecanico', 'repuesto'],
    'transmision': ['transmision', 'caja', 'velocidad'],
    'caja': ['caja', 'transmision', 'velocidad'],
    'radiador': ['radiador', 'enfriamiento', 'agua'],
    'termostato': ['termostato', 'enfriamiento', 'temperatura'],
    'camion': ['camion', 'camiones', 'tracto', 'tractor', 'camioneta'],
    'tracto': ['tracto', 'tractor', 'camion'],
    'faro': ['faro', 'faros', 'luz', 'luz delantera'],
    'faros': ['faro', 'faros', 'luz', 'luz delantera'],
    'espejo': ['espejo', 'espejos'],
    'espejos': ['espejo', 'espejos'],
    'vidrio': ['vidrio', 'vidrios', 'cristal'],
    'parachoques': ['parachoques', 'defensa'],
    'defensa': ['defensa', 'parachoques'],
    'turbo': ['turbo', 'turbocargador'],
    'turbocargador': ['turbo', 'turbocargador'],
  };

  async searchRelevantProducts(userMessage) {
    const stopWords = ['para', 'que', 'como', 'cual', 'cuales', 'donde', 'cuando', 'tengo', 'necesito', 'quiero', 'puedo', 'hay', 'tienen', 'cuanto', 'cuesta', 'precio', 'ustedes', 'esta', 'este', 'esto', 'pero', 'con', 'por', 'una', 'uno', 'los', 'las', 'del', 'al', 'el', 'la', 'un', 'se', 'no', 'si', 'me', 'mi', 'tu', 'su', 'es', 'son', 'fue', 'ser', 'mas', 'muy', 'bien', 'gracias', 'hola', 'buenas', 'dia', 'tardes', 'noches', 'algo', 'algun', 'otro', 'otros', 'tambien', 'sobre', 'entre', 'desde', 'hasta', 'todos', 'cada'];

    const words = userMessage
      .toLowerCase()
      .replace(/[^\w\sáéíóúñ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));

    const expandedWords = new Set(words);
    for (const w of words) {
      const syns = ChatService.SYNONYMS[w];
      if (syns) syns.forEach(s => expandedWords.add(s));
    }
    const searchWords = [...expandedWords];

    const fromClause = `
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
    `;

    let result;

    if (searchWords.length === 0) {
      result = await pool.query(`
        SELECT p.id, p.name, p.price, p.discount_percent, COALESCE(SUM(i.stock), 0) as total_stock
        ${fromClause}
        WHERE p.available = true
        GROUP BY p.id, b.name, c.name
        HAVING COALESCE(SUM(i.stock), 0) > 0
        ORDER BY RANDOM() LIMIT 5
      `);
    } else {
      const conditions = searchWords.map((_, i) => {
        const base = i * 4;
        return `(p.name ILIKE $${base + 1} OR p.description ILIKE $${base + 2} OR b.name ILIKE $${base + 3} OR c.name ILIKE $${base + 4})`;
      }).join(' OR ');
      const params = searchWords.flatMap(w => [`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`]);

      result = await pool.query(`
        SELECT p.id, p.name, p.price, p.discount_percent, COALESCE(SUM(i.stock), 0) as total_stock
        ${fromClause}
        WHERE p.available = true AND (${conditions})
        GROUP BY p.id, b.name, c.name
        HAVING COALESCE(SUM(i.stock), 0) > 0
        ORDER BY p.name ASC
        LIMIT 10
      `, params);

      if (result.rows.length === 0) {
        result = await pool.query(`
          SELECT p.id, p.name, p.price, p.discount_percent, COALESCE(SUM(i.stock), 0) as total_stock
          ${fromClause}
          WHERE p.available = true AND (${conditions})
          GROUP BY p.id, b.name, c.name
          HAVING COALESCE(SUM(i.stock), 0) > 0
          ORDER BY p.name ASC LIMIT 5
        `, params);
      }

      if (result.rows.length === 0) {
        result = await pool.query(`
          SELECT p.id, p.name, p.price, p.discount_percent, COALESCE(SUM(i.stock), 0) as total_stock
          ${fromClause}
          WHERE p.available = true
          GROUP BY p.id, b.name, c.name
          HAVING COALESCE(SUM(i.stock), 0) > 0
          ORDER BY RANDOM() LIMIT 5
        `);
      }
    }

    return result.rows.map(p => {
      const discountedPrice = p.discount_percent > 0
        ? Math.round(Number(p.price) * (1 - Number(p.discount_percent) / 100) * 100) / 100
        : Number(p.price);
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        discountedPrice,
        discount: Number(p.discount_percent) || 0,
        stock: Number(p.total_stock),
      };
    });
  }

  async getOrCreateSession(sessionId, userId = null) {
    if (sessionId) {
      const existing = await pool.query('SELECT id FROM chat_sessions WHERE id = $1', [sessionId]);
      if (existing.rows.length > 0) return sessionId;
    }
    const result = await pool.query('INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING id', [userId]);
    return result.rows[0].id;
  }

  async getSessionMessages(sessionId) {
    const result = await pool.query(
      `SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return result.rows;
  }

  async getUserSessions(userId, limit = 20) {
    const result = await pool.query(
      `SELECT id, title, message_count, last_message_at, last_assistant_preview
       FROM chat_sessions_preview
       WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async saveMessage(sessionId, role, content, { tokenCount = null, isComplete = true } = {}) {
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, token_count, is_streaming_complete)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, role, content, tokenCount, isComplete]
    );
  }

  async sendMessage(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);
    await this.saveMessage(currentSessionId, 'user', userContent);

    const { chatMessages } = await this._buildContext(userContent, currentSessionId, userId);

    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages: chatMessages, temperature: 0, max_tokens: 512 }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (response.status === 429) {
          try {
            const errorData = JSON.parse(errorText);
            const msg = errorData.error?.message || '';
            const match = msg.match(/Please try again in (\d+\.?\d*)(s|ms)/);
            if (match) {
              let retryAfter = parseFloat(match[1]);
              if (match[2] === 'ms') retryAfter = retryAfter / 1000;
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              retryCount++;
              continue;
            }
          } catch (e) {
            throw new Error(`Groq API error: ${response.status} - ${errorText}`);
          }
        }
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';
      const tokenCount = data.usage?.completion_tokens ?? null;
      await this.saveMessage(currentSessionId, 'assistant', content, { tokenCount });
      return { content, sessionId: currentSessionId };
    }

    throw new Error('Rate limit exceeded after retries');
  }

  async prepareStream(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);
    await this.saveMessage(currentSessionId, 'user', userContent);

    const { chatMessages } = await this._buildContext(userContent, currentSessionId, userId);

    return { sessionId: currentSessionId, chatMessages };
  }

  async _buildContext(userContent, sessionId, userId) {
    const intent = ContextBuilder.detectIntent(userContent);

    const relevantProducts = await this.searchRelevantProducts(userContent);
    const catalog = CatalogFormatter.format(relevantProducts);

    const knowledge = ContextBuilder.getKnowledgeForIntent(intent);
    const userContext = await ContextBuilder.getUserContext(userId, intent);
    const userContextStr = ContextBuilder.formatUserContext(userContext, intent);

    const systemPrompt = PromptBuilder.build({ knowledge, catalog, userContext, userContextStr });

    const rawHistory = await this.getSessionMessages(sessionId);
    const trimmed = ConversationSummarizer.trimHistory(rawHistory);

    const chatMessages = [
      { role: 'system', content: systemPrompt },
    ];

    if (trimmed.summary) {
      chatMessages.push({ role: 'system', content: trimmed.summary });
    }

    for (const msg of trimmed.messages) {
      chatMessages.push({ role: msg.role, content: msg.content });
    }

    return { chatMessages, intent };
  }

  async saveStreamedMessage(sessionId, content, tokenCount = null) {
    await this.saveMessage(sessionId, 'assistant', content, { tokenCount, isComplete: true });
  }
}
