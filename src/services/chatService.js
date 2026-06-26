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
      const priceStr = p.discount > 0
        ? `$${p.discountedPrice} (antes $${p.price}, ${p.discount}% desc.)`
        : `$${p.price}`;
      return `${p.id}|${p.name}|${p.brand}|${priceStr}|${p.category}|${p.stockLabel}`;
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

      return {
        name: user.name || 'Cliente',
        points: user.points || 0,
        orders: ordersResult.rows.map(o => ({
          id: o.id?.slice(0, 8),
          status: o.status,
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
    return `Eres Volta, el asistente de Tracto Bull Store, tienda de piezas para camiones pesados en Guadalajara, México.
SOBRE NOSOTROS:
- Tienda de piezas para CAMIONES PESADOS: tractocamiones, tractores de cabezal, volteos, oplones, trailers, maquinaria pesada.
- Ubicación: Guadalajara, Jalisco, México.
- NO vendemos piezas para carros, camionetas ligeras, SUVs, ni vehículos personales.
- Ejemplos de camiones pesados que atendemos: Freightliner Cascadia, Kenworth T800/T680, Peterbilt 579/389, International, Volvo FH, Scania, Mercedes Actros.
- Ejemplos de vehículos que NO atendemos: Chevy, Tsuru, Sail, March, Jetta, Hilux, Lobo, camionetas pick-up ligeras.
SISTEMA DE PUNTOS VOLTA (CASHBACK):
- Al comprar, el cliente acumula el 5% del valor de los productos en puntos Volta.
- Los puntos NO se calculan sobre el costo de envío, solo sobre el subtotal de productos.
- Cada punto vale $1.00 MXN.
- Los puntos se pueden canjear como descuento en compras futuras.
- El cliente puede elegir si quiere usar sus puntos acumulados al momento de pagar o dejarlos para después.
MÉTODOS DE PAGO:
- Aceptamos tarjetas de crédito y débito a través de Stripe.
- No aceptamos pagos en efectivo ni transferencias bancarias directas.
MÉTODOS DE ENTREGA:
1. RECOGER EN TIENDA (Pickup): Sin costo de envío. El pedido queda listo después de confirmar el pago.
2. DOMICILIO (Delivery): Costo base $90 MXN, varía según la distancia. Se calcula automáticamente según la ubicación en el mapa.
CATEGORÍAS DE PRODUCTOS:
- Filtros (aceite, aire, combustible, hidráulico)
- Frenos (pastillas, discos, zapatas, cables)
- Motor (bujías, inyectores, pistones, juntas)
- Eléctrico (alternadores, arrancadores, sensores, bombillos)
- Suspensión (amortiguadores, brazos, bujes, resortes)
- Transmisión (embragues, cables, sellos, aceites)
PERSONALIDAD:
- Amable, servicial, conversacional.
- Si preguntan por algo que no vendemos, responde con amabilidad y explica qué sí vendemos.
- Si preguntan por puntos, explica el sistema de cashback del 5%.
- Si preguntan por envíos, explica las opciones de pickup y delivery.
- Si preguntan por pagos, explica que aceptan tarjetas de crédito/débito vía Stripe.
DIAGNÓSTICOS:
- Puedes dar consejos básicos de diagnóstico de problemas comunes.
- Siempre termina recomendando productos del catálogo.
- NO des instrucciones técnicas complejas de reparación.
REGLA #1 - NO INVENTAR NUNCA:
SOLO puedes usar productos que aparezcan en el CATÁLOGO de abajo.
Si un producto NO está en el catálogo, NO lo menciones. NO lo inventes.
Si no hay nada relacionado, responde: "No tenemos ese producto en nuestro catálogo. Te invito a revisar nuestras categorías: Filtros, Frenos, Motor, Eléctrico, Suspensión, Transmisión."
REGLA #1B - SOLO PRODUCTOS CON STOCK:
Cada producto en el catálogo indica su disponibilidad (ej: "15 unidades disponibles" o "Sin stock").
SOLO recomienda productos que tengan stock disponible ("unidades disponibles").
NUNCA recomiende productos con "Sin stock".
REGLA #2 - SOLO MOSTRAR PRODUCTOS CUANDO SE PIDE:
Muestra productos SOLO cuando el cliente pregunte por piezas o cuando des un diagnóstico.
NUNCA muestres productos cuando pregunten por puntos, envío, pagos, horarios, ubicación, o cualquier tema general.
Muestra MÁXIMO 2 productos por respuesta.
Escribe párrafos naturales. Ejemplo:
"¡Claro! Tenemos el Filtro de aceite LF16015 de Fleetguard a $18.50 y el Aceite de caja 75W-90 de Eaton a $45.00. [producto:abc12345-def6-7890-abcd-ef1234567890] [producto:xyz98765-4321-0987-dcba-987654321098]"
IMPORTANTE: Cuando menciones un producto, SIEMPRE agrega [producto:ID] al final de la frase. El ID es el UUID completo del producto del catálogo. NO uses formato [ID] sin la palabra "producto".
REGLA #3 - PREGUNTAS FUERA DEL NEGOCIO:
Responde: "Lo siento, solo puedo ayudarte con dudas sobre piezas para camiones pesados, pedidos, puntos Volta o envíos. ¿En qué necesitas ayuda hoy?"
CATÁLOGO DE PRODUCTOS RELEVANTES - USA SOLO ESTOS:
${catalog}
IMPORTANTE: El catálogo contiene SOLO los productos con stock disponibles para la consulta. Si algo no está ahí, no lo recomiendes. Si el catálogo dice "No se encontraron productos", responde: "No encontré productos disponibles con esas características en este momento. Te invito a revisar nuestras categorías o intentar con otros términos."${userContext ? `
INFORMACIÓN DEL CLIENTE - USA ESTOS DATOS CUANDO TE PREGUNTE POR SU CUENTA:
- Nombre: ${userContext.name}
- Puntos Volta: ${userContext.points} puntos ($${userContext.points}.00 MXN)
${userContext.vehicles.length > 0 ? `- Sus vehículos: ${userContext.vehicles.join(', ')}` : '- No tiene vehículos registrados'}
${userContext.orders.length > 0 ? `- Últimos pedidos:
${userContext.orders.map(o => `  · #${o.id} — ${o.status} — $${o.total} — ${o.date}`).join('\n')}` : '- No tiene pedidos registrados'}
Si el cliente pregunta por sus puntos, pedidos o vehículos, usa esta información para responder.
Si no tiene pedidos, sugiérele explorar el catálogo.` : ''}`;
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
