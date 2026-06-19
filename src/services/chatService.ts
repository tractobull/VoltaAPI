import pool from '../db/pool';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqResponse {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ChatService {
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }

  private async buildProductCatalog(): Promise<string> {
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
      const cat = p.category_name || '';
      const vehicles = p.brands
        ? `${p.brands.join('/')} ${p.year_start || ''}-${p.year_end || ''} ${(p.engines || []).join('/')}`
        : '';
      const oem = p.oem_numbers?.length ? ` OEM:${p.oem_numbers.join(',')}` : '';
      return `${p.id}|${p.name}|${p.brand_name}|$${p.price}|${cat}|${p.available ? 'Disp' : 'No'}|${vehicles}${oem}`;
    }).join('\n');
  }

  private async buildSystemPrompt(): Promise<string> {
    const catalog = await this.buildProductCatalog();

    return `Eres Volta, el asistente de Tracto Bull Store, tienda de piezas para camiones pesados en Guadalajara, México.

SOBRE NOSOTROS:
- Vendemos piezas para CAMIONES PESADOS: tractocamiones, tractores de cabezal, volteos,oplones, trailers, maquinaria pesada.
- NO vendemos piezas para carros, camionetas ligeras, SUVs, ni vehículos personales.
- Ejemplos de camiones pesados: Freightliner Cascadia, Kenworth T800, Peterbilt 579, International, Volvo FH, Scania, Mercedes Actros.
- Ejemplos de vehículos que NO atendemos: Chevy Pop, Tsuru, Sail, March, Jetta, Hilux, Lobo.

PERSONALIDAD:
- Amable, servicial, conversacional.
- Si preguntan por algo que no vendemos (carro, camioneta ligera), responde con amabilidad y explica qué sí vendemos.

REGLA #1 - NO INVENTAR NUNCA:
SOLO puedes usar productos que aparezcan en el CATÁLOGO de abajo.
Si un producto NO está en el catálogo, NO lo menciones. NO lo inventes.
Si no hay nada relacionado en el catálogo, responde: "No tenemos ese producto en nuestro catálogo. Te invito a revisar nuestras categorías: Filtros, Frenos, Motor, Eléctrico, Suspensión, Transmisión."

REGLA #2 - PRODUCTOS Y FORMATO:
Muestra MÁXIMO 2 productos por respuesta.
Escribe como si hablaras con un cliente en persona. NO uses bullets (*), NO uses listas con guiones.
Escribe párrafos naturales. Ejemplo correcto:
"¡Claro! Tenemos el Filtro de aceite LF16015 de Fleetguard a $18.50 y el Aceite de caja 75W-90 de Eaton a $45.00. [producto:oil-filter] [producto:gearbox-oil]"
Cuando menciones un producto, agrega el tag al final del párrafo.
El tag SIEMPRE debe ser [producto:ID] donde ID es el id exacto del catálogo.

CATÁLOGO COMPLETO - USA SOLO ESTOS PRODUCTOS:
${catalog}

IMPORTANTE: El catálogo de arriba es TU ÚNICA fuente de información. Si algo no está ahí, no existe para ti.`;
  }

  async sendMessage(
    messages: ChatMessage[],
    sessionId?: string
  ): Promise<{ content: string; sessionId: string }> {
    // Create or get session
    let sessionResult;
    if (sessionId) {
      sessionResult = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = $1',
        [sessionId]
      );
    }

    if (!sessionResult || sessionResult.rows.length === 0) {
      sessionResult = await pool.query(
        'INSERT INTO chat_sessions DEFAULT VALUES RETURNING id'
      );
    }

    const currentSessionId = sessionResult.rows[0].id;

    // Save user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      await pool.query(
        'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
        [currentSessionId, 'user', lastUserMessage.content]
      );
    }

    // Build messages with system prompt
    const systemPrompt = await this.buildSystemPrompt();
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Call Groq API
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: chatMessages,
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GroqResponse;
    const content = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    // Save assistant message
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [currentSessionId, 'assistant', content]
    );

    return { content, sessionId: currentSessionId };
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    return result.rows.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
  }
}
