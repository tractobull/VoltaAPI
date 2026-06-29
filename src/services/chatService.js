import pool from '../db/pool.js';

export class ChatService {
  constructor() {
    this.apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  // ─── Busqueda inteligente de productos ────────────────────────────────────

  // Synonyms: truck part slang -> canonical search terms
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

    // Expand with synonyms
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
        SELECT p.id, p.name, p.price, p.discount_percent, p.image, p.available,
               b.name as brand_name, c.name as category_name,
               COALESCE(SUM(i.stock), 0) as total_stock
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
        SELECT p.id, p.name, p.price, p.discount_percent, p.image, p.available,
               b.name as brand_name, c.name as category_name,
               COALESCE(SUM(i.stock), 0) as total_stock
        ${fromClause}
        WHERE p.available = true AND (${conditions})
        GROUP BY p.id, b.name, c.name
        HAVING COALESCE(SUM(i.stock), 0) > 0
        ORDER BY p.name ASC
        LIMIT 10
      `, params);

      if (result.rows.length === 0) {
        result = await pool.query(`
          SELECT p.id, p.name, p.price, p.discount_percent, p.image, p.available,
                 b.name as brand_name, c.name as category_name,
                 COALESCE(SUM(i.stock), 0) as total_stock
          ${fromClause}
          WHERE p.available = true AND (${conditions})
          GROUP BY p.id, b.name, c.name
          HAVING COALESCE(SUM(i.stock), 0) > 0
          ORDER BY p.name ASC LIMIT 5
        `, params);
      }

      // Si no hay coincidencias con stock, mostrar productos populares con stock
      if (result.rows.length === 0) {
        result = await pool.query(`
          SELECT p.id, p.name, p.price, p.discount_percent, p.image, p.available,
                 b.name as brand_name, c.name as category_name,
                 COALESCE(SUM(i.stock), 0) as total_stock
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
        id: p.id, name: p.name, brand: p.brand_name, category: p.category_name,
        price: Number(p.price), discountedPrice,
        discount: Number(p.discount_percent) || 0,
        stock: Number(p.total_stock),
        stockLabel: p.total_stock > 0 ? `${p.total_stock} unidades disponibles` : 'Sin stock',
      };
    });
  }

  formatCatalogForAI(products) {
    if (products.length === 0) return 'No se encontraron productos relevantes en el catálogo.';
    return products.map(p => {
      const discountedPrice = p.discount > 0
        ? Math.round(Number(p.price) * (1 - Number(p.discount) / 100) * 100) / 100
        : Number(p.price);
      const priceStr = p.discount > 0
        ? `$${discountedPrice} (antes $${p.price})`
        : `$${p.price}`;
      return `${p.id}|${p.name}|${priceStr}|${p.stock > 0 ? `${p.stock} unidades` : 'Sin stock'}`;
    }).join('\n');
  }

  // ─── System prompt ────────────────────────────────────────────────────────

  async getUserContext(userId) {
    if (!userId) return null;
    try {
      const userResult = await pool.query(
        'SELECT id, name, email, phone, points FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) return null;
      const user = userResult.rows[0];

      const ordersResult = await pool.query(
        `SELECT id, status, total, created_at
         FROM orders WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      );

      const vehiclesResult = await pool.query(
        'SELECT brand, model, year, engine FROM vehicles WHERE user_id = $1',
        [userId]
      );

      const statusTranslations = {
        PENDING: 'pendiente de confirmación',
        CONFIRMED: 'confirmado',
        PROCESSING: 'en preparación',
        SHIPPED: 'en camino',
        DELIVERED: 'entregado',
        CANCELLED: 'cancelado',
      };

      return {
        name: user.name || 'Cliente',
        points: user.points || 0,
        orders: ordersResult.rows.map(o => ({
          id: o.id?.slice(0, 8),
          status: statusTranslations[o.status] || o.status,
          total: Number(o.total),
          date: o.created_at?.toISOString?.()?.split('T')[0],
        })),
        vehicles: vehiclesResult.rows.map(v => `${v.brand} ${v.model} ${v.year}${v.engine ? ' (' + v.engine + ')' : ''}`),
      };
    } catch (err) {
      console.error('Error fetching user context:', err);
      return null;
    }
  }

  buildSystemPrompt(catalog, userContext = null) {
    return `Eres Volta, asistente virtual de Tracto Bull Store, especialista en refacciones para camiones pesados y maquinaria pesada en Guadalajara, Jalisco, México.

NEGOCIO
- Solo vendemos refacciones para camiones pesados, tractocamiones, trailers, volteos y maquinaria pesada.
- No atendemos automóviles, SUVs, camionetas ligeras o vehículos particulares.

PUNTOS VOLTA
- Cashback del 5% sobre el subtotal de productos (no incluye envío).
- 1 punto = $1 MXN.
- Los puntos pueden acumularse o utilizarse como descuento al pagar.

PAGOS
- Solo aceptamos tarjetas de crédito y débito mediante Stripe.

ENTREGA
- Pickup: sin costo.
- Delivery: desde $90 MXN según distancia.

CATEGORÍAS
Filtros, Frenos, Motor, Eléctrico, Suspensión y Transmisión.

COMPORTAMIENTO
- Responde de forma amable, breve y conversacional.
- Si preguntan por pagos, envíos o puntos, responde únicamente sobre ese tema.
- Si preguntan por algo que no vendemos, indícalo amablemente y explica que solo manejamos refacciones para camiones pesados.

DIAGNÓSTICOS
- Puedes dar orientación básica para identificar fallas comunes.
- Nunca des procedimientos complejos de reparación.
- Siempre que sea posible termina recomendando productos del catálogo.

PRODUCTOS
- Usa exclusivamente productos del catálogo.
- Nunca inventes productos.
- Recomienda únicamente productos con stock disponible.
- Si el catálogo indica "Sin stock", ignóralos.
- Muestra productos solo cuando el usuario pregunte por piezas o durante un diagnóstico.
- Nunca muestres productos en preguntas generales (pagos, envíos, puntos, horarios, ubicación, etc.).
- Muestra máximo 2 productos.
- Cada producto mencionado debe terminar exactamente con:
  [producto:UUID]
  usando el UUID completo del catálogo.

Si el catálogo dice "No se encontraron productos relevantes en el catálogo.", responde:
"No encontré productos disponibles con esas características en este momento. Te invito a revisar nuestras categorías o intentar con otros términos."

PREGUNTAS FUERA DEL NEGOCIO
Si la consulta no está relacionada con la tienda responde:
"Lo siento, solo puedo ayudarte con dudas sobre refacciones para camiones pesados, pedidos, puntos Volta y envíos."

PEDIDOS
Si preguntan por pedidos, utiliza únicamente la información del cliente incluida abajo.
Puedes responder sobre:
- estado
- fecha
- total

Cuando el usuario pregunte por su pedido:
1. Si el usuario menciona "hoy", "ayer", "reciente", busca el pedido más reciente y muestra su información
2. Si el usuario proporciona un número de pedido (tracking), busca ese pedido específico
3. Si no hay suficientes detalles, pregunta amablemente por el número de pedido o fecha
4. Si el usuario dice "hoy" pero el pedido más reciente tiene una fecha diferente, aclara: "Tu pedido más reciente es del [fecha] con estado [estado]. ¿Te refieres a este pedido?"

Siempre muestra la información disponible primero (estado, fecha, total).
Si el usuario pregunta por información que no existe (rastreo exacto, ubicación del repartidor, tiempos precisos, método de entrega, dirección, etc.) después de que ya le mostraste la información disponible, responde con "[HUMANO]" al inicio de tu respuesta.

SOPORTE HUMANO
Responde con "[HUMANO]" al inicio cuando:
- el usuario solicite un agente humano;
- el problema requiera investigación manual;
- solicite rastreo detallado del pedido;
- esté claramente molesto o frustrado;
- no entiendas la consulta después de dos intentos.

Cuando uses "[HUMANO]", SIEMPRE incluye un resumen breve de la conversación en primera persona (como si el usuario estuviera escribiendo el mensaje) en el formato:
[HUMANO] [RESUMEN: mensaje en primera persona que el usuario enviaría al soporte]

Luego escribe tu mensaje de respuesta normal. NO repitas el contenido del resumen en tu respuesta.

Ejemplo:
[HUMANO] [RESUMEN: Mi pedido #9f651cc3 de $31.06 está pendiente de confirmación desde hace varios días y no ha llegado. Necesito información de rastreo detallado.] Te pondré en contacto con uno de nuestros agentes para ayudarte con el seguimiento de tu pedido.

CATÁLOGO
${catalog}

${userContext ? `
CLIENTE
Nombre: ${userContext.name}
Puntos: ${userContext.points} ($${userContext.points}.00 MXN)

Vehículos:
${userContext.vehicles.length ? userContext.vehicles.join(', ') : 'Sin vehículos registrados'}

Pedidos:
${userContext.orders.length
  ? userContext.orders.map(o =>
`- #${o.id} | ${o.status} | $${o.total} | ${o.date}` 
).join('\n')
  : 'Sin pedidos registrados'}

Usa estos datos únicamente cuando el cliente pregunte por su cuenta, pedidos, vehículos o puntos.
` : ''}`;
  }

  // ─── Sesiones ──────────────────────────────────────────────────────────────

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

  // ─── Guardado de mensajes ──────────────────────────────────────────────────

  async saveMessage(sessionId, role, content, { tokenCount = null, isComplete = true } = {}) {
    await pool.query(
      `INSERT INTO chat_messages (session_id, role, content, token_count, is_streaming_complete)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, role, content, tokenCount, isComplete]
    );
  }

  // ─── Envío (sin streaming) ────────────────────────────────────────────────

  async sendMessage(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);
    await this.saveMessage(currentSessionId, 'user', userContent);

    const history = await this.getSessionMessages(currentSessionId);
    const relevantProducts = await this.searchRelevantProducts(userContent);
    const catalog = this.formatCatalogForAI(relevantProducts);
    const userContext = await this.getUserContext(userId);
    const systemPrompt = this.buildSystemPrompt(catalog, userContext);

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

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

  // ─── Stream (flujo principal) ─────────────────────────────────────────────

  async prepareStream(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);
    await this.saveMessage(currentSessionId, 'user', userContent);

    const history = await this.getSessionMessages(currentSessionId);
    const relevantProducts = await this.searchRelevantProducts(userContent);
    const catalog = this.formatCatalogForAI(relevantProducts);
    const userContext = await this.getUserContext(userId);
    const systemPrompt = this.buildSystemPrompt(catalog, userContext);

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    return { sessionId: currentSessionId, chatMessages };
  }

  async saveStreamedMessage(sessionId, content, tokenCount = null) {
    await this.saveMessage(sessionId, 'assistant', content, { tokenCount, isComplete: true });
  }
}
