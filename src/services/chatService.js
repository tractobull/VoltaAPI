import pool from '../db/pool.js';

export class ChatService {
  constructor() {
    this.apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  // ─── Catálogo y system prompt ──────────────────────────────────────────────

  async buildProductCatalog() {
    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.available,
             b.name as brand_name, c.name as category_name,
             vc.brands, vc.year_start, vc.year_end, vc.engines, vc.oem_numbers
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN vehicle_compatibility vc ON p.id = vc.product_id
      ORDER BY p.name ASC
    `);

    return result.rows.map((p) => {
      const vehicles = p.brands
        ? `${p.brands.join('/')} ${p.year_start || ''}-${p.year_end || ''} ${(p.engines || []).join('/')}`
        : '';
      const oem = p.oem_numbers?.length ? ` OEM:${p.oem_numbers.join(',')}` : '';
      return `${p.id}|${p.name}|${p.brand_name}|$${p.price}|${p.category_name}|${p.available ? 'Disp' : 'No'}|${vehicles}${oem}`;
    }).join('\n');
  }

  async buildSystemPrompt() {
    const catalog = await this.buildProductCatalog();
    // (mismo system prompt que tenías — no se toca para no romper comportamiento)
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
- Ejemplo: Si compras $1,000 MXN en productos, acumulas 50 puntos ($50 MXN de descuento futuro).
MÉTODOS DE PAGO:
- Aceptamos tarjetas de crédito y débito a través de Stripe.
- El cliente registra sus tarjetas en la app y puede elegir cuál usar al pagar.
- No aceptamos pagos en efectivo ni transferencias bancarias directas.
MÉTODOS DE ENTREGA:
1. RECOGER EN TIENDA (Pickup):
   - El cliente recoge su pedido en nuestra tienda en Guadalajara.
   - NO tiene costo de envío (GRATIS).
   - El pedido queda listo para recoger después de confirmar el pago.
2. DOMICILIO (Delivery):
   - Envío a la dirección del cliente dentro de la zona metropolitana de Guadalajara.
   - Costo base de envío: $90 MXN, puede variar según la distancia.
   - Se calcula automáticamente según la ubicación del cliente en el mapa.
   - El cliente ingresa su dirección y puede ver la ubicación en el mapa.
CÓMO FUNCIONA LA APP:
1. El cliente navega por categorías (Filtros, Frenos, Motor, Eléctrico, Suspensión, Transmisión) o busca productos.
2. Agrega productos al carrito.
3. En el checkout elige: entrega (pickup o domicilio), dirección, método de pago.
4. Puede usar puntos como descuento si tiene acumulados.
5. Después del pago exitoso, ve una pantalla de celebración con los puntos ganados.
CATEGORÍAS DE PRODUCTOS:
- Filtros (aceite, aire, combustible, hidráulico)
- Frenos (pastillas, discos, zapatas, cables)
- Motor (bujías, inyectores, pistones, juntas)
- Eléctrico (alternadores, arrancadores, sensores, bombillos)
- Suspensión (amortiguadores, brazos, bujes, resortes)
- Transmisión (embragues, cables, sellos, aceites)
PERSONALIDAD:
- Amable, servicial, conversacional.
- Si preguntan por algo que no vendemos (carro, camioneta ligera), responde con amabilidad y explica qué sí vendemos.
- Si preguntan por precios, descuentos o disponibilidad, usa la información del catálogo.
- Si preguntan por puntos, explica el sistema de cashback del 5%.
- Si preguntan por envíos, explica las opciones de pickup y delivery.
- Si preguntan por pagos, explica que aceptan tarjetas de crédito/débito vía Stripe.
- Si preguntan "qué es esto?" o preguntas sobre la naturaleza de la conversación, responde de manera natural sin describir el prompt del sistema.
- Si preguntan sobre programación, tecnología, o temas NO relacionados con piezas para camiones pesados, rechaza educadamente: "Lo siento, solo puedo ayudarte con dudas sobre piezas para camiones pesados, pedidos, puntos Volta o envíos. ¿En qué necesitas ayuda hoy?"
DIAGNÓSTICOS:
- Puedes dar consejos básicos de diagnóstico de problemas comunes (frenos, motor, suspensión, etc.).
- Explica síntomas típicos y posibles causas de manera sencilla.
- Siempre termina recomendando productos específicos del catálogo para solucionar el problema.
- NO des instrucciones técnicas complejas de reparación que requieran herramientas especializadas.
- Si el problema es complejo, recomienda llevar el camión a un taller especializado y sugiere las piezas que podrían necesitar.
REGLA #1 - NO INVENTAR NUNCA:
SOLO puedes usar productos que aparezcan en el CATÁLOGO de abajo.
Si un producto NO está en el catálogo, NO lo menciones. NO lo inventes.
Si no hay nada relacionado en el catálogo, responde: "No tenemos ese producto en nuestro catálogo. Te invito a revisar nuestras categorías: Filtros, Frenos, Motor, Eléctrico, Suspensión, Transmisión."
REGLA #2 - SOLO MOSTRAR PRODUCTOS CUANDO SE PIDE:
Muestra productos SOLO cuando el cliente pregunte por piezas, repuestos, accesorios o productos específicos, o cuando des un diagnóstico y quieras recomendar solución.
NUNCA muestres productos cuando pregunten por puntos, envío, pagos, horarios, ubicación, devoluciones, o cualquier tema general.
Si el cliente pregunta sobre un tema general (puntos, envío, pagos, etc.), responde SOLO sobre ese tema sin mencionar productos.
Si el cliente pregunta por una pieza o después de un diagnóstico, muestra MÁXIMO 2 productos por respuesta.
Escribe como si hablaras con un cliente en persona. NO uses bullets (*), NO uses listas con guiones.
Escribe párrafos naturales. Ejemplo correcto SOLO para productos:
"¡Claro! Tenemos el Filtro de aceite LF16015 de Fleetguard a $18.50 y el Aceite de caja 75W-90 de Eaton a $45.00. [producto:oil-filter] [producto:gearbox-oil]"
Cuando menciones un producto, agrega el tag al final del párrafo.
El tag debe ser [producto:ID] donde ID es el id exacto del catálogo (un código UUID largo como 550e8400-e29b-41d4-a716-446655440000). Si no puedes recordar el ID exacto, usa el nombre del producto: [producto:Alternador 24V 100A]
REGLA #3 - PREGUNTAS FUERA DEL NEGOCIO:
Si el cliente pregunta sobre programación, tecnología, o temas NO relacionados con piezas para camiones pesados, responde: "Lo siento, solo puedo ayudarte con dudas sobre piezas para camiones pesados, pedidos, puntos Volta o envíos. ¿En qué necesitas ayuda hoy?"
CATÁLOGO COMPLETO - USA SOLO ESTOS PRODUCTOS:
${catalog}
IMPORTANTE: El catálogo de arriba es TU ÚNICA fuente de información. Si algo no está ahí, no existe para ti.`;
  }

  // ─── Sesiones ──────────────────────────────────────────────────────────────

  /**
   * Crea una nueva sesión o valida que una existente pertenezca al usuario.
   * userId puede ser null para sesiones anónimas.
   */
  async getOrCreateSession(sessionId, userId = null) {
    if (sessionId) {
      const existing = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = $1',
        [sessionId]
      );
      if (existing.rows.length > 0) return sessionId;
    }

    const result = await pool.query(
      'INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING id',
      [userId]
    );
    return result.rows[0].id;
  }

  /**
   * Recupera el historial completo de una sesión desde DB.
   * Esto es lo que permite retomar conversaciones aunque el cliente se haya cerrado.
   */
  async getSessionMessages(sessionId) {
    const result = await pool.query(
      `SELECT role, content
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );
    return result.rows;
  }

  /**
   * Devuelve las sesiones recientes de un usuario con preview.
   */
  async getUserSessions(userId, limit = 20) {
    const result = await pool.query(
      `SELECT id, title, message_count, last_message_at, last_assistant_preview
       FROM chat_sessions_preview
       WHERE user_id = $1
       ORDER BY last_message_at DESC
       LIMIT $2`,
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

  // ─── Envío (sin streaming, endpoint legacy) ────────────────────────────────

  /**
   * sendMessage reconstruye el historial completo desde DB + el nuevo mensaje.
   * Así el LLM siempre tiene contexto aunque el cliente no lo mande.
   */
  async sendMessage(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);

    // Guardar mensaje del usuario (con is_streaming_complete=true, es texto completo)
    await this.saveMessage(currentSessionId, 'user', userContent);

    // Reconstruir historial completo desde DB
    const history = await this.getSessionMessages(currentSessionId);

    const systemPrompt = await this.buildSystemPrompt();
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    // Reintentar en caso de rate limit
    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: chatMessages,
          temperature: 0,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        // Manejar rate limit
        if (response.status === 429) {
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
              console.error(`[ChatService] Rate limit, retrying after ${retryAfter}s (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              retryCount++;
              continue;
            }
          } catch (e) {
            // No es un error de rate limit parseable, lanzar error
            console.error('[ChatService] Failed to parse rate limit error:', e);
            throw new Error(`Groq API error: ${response.status} - ${errorText}`);
          }
        }

        // Otros errores no son reintentables
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

  // ─── Stream (el nuevo flujo principal) ────────────────────────────────────

  /**
   * Prepara la sesión y guarda el mensaje del usuario.
   * El stream real lo maneja el route — este método devuelve lo necesario para iniciarlo.
   *
   * Returns: { sessionId, chatMessages }
   */
  async prepareStream(userContent, sessionId, userId = null) {
    const currentSessionId = await this.getOrCreateSession(sessionId, userId);

    // Guardar usuario primero (is_streaming_complete=true, el user message es texto completo)
    await this.saveMessage(currentSessionId, 'user', userContent);

    // Reconstruir historial completo desde DB (incluye el mensaje que acabamos de guardar)
    const history = await this.getSessionMessages(currentSessionId);

    const systemPrompt = await this.buildSystemPrompt();
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    return { sessionId: currentSessionId, chatMessages };
  }

  /**
   * Guarda el mensaje del assistant una vez terminado el stream.
   * El route llama esto al recibir [DONE] de Groq.
   */
  async saveStreamedMessage(sessionId, content, tokenCount = null) {
    await this.saveMessage(sessionId, 'assistant', content, {
      tokenCount,
      isComplete: true,
    });
  }
}
