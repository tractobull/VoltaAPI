function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return Math.max(m, n);
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      if (i === j && dp[i][j] > 3) return dp[i][j];
    }
  }
  return dp[m][n];
}

const INTENT_PATTERNS = [
  {
    intent: 'payments',
    keywords: ['pago', 'pagar', 'tarjeta', 'credito', 'debito', 'stripe', 'metodo de pago', 'forma de pago', 'factura', 'american express', 'visa', 'mastercard', 'cobro', 'cobrar'],
  },
  {
    intent: 'shipping',
    keywords: ['envio', 'enviar', 'entrega', 'domicilio', 'recoger', 'recogida', 'pickup', 'costo de envio', 'cuanto cuesta el envio', 'tienda', 'direccion', 'ubicacion', 'donde estan', 'llegar', 'tarda'],
  },
  {
    intent: 'rewards',
    keywords: ['punto', 'puntos', 'volta', 'cashback', 'descuento', 'acumular', 'canjear', 'bonus', 'bono', 'recompensa'],
  },
  {
    intent: 'diagnostics',
    keywords: ['falla', 'fallando', 'problema', 'ruido', 'no funciona', 'no prende', 'no arranca', 'diagnostico', 'que necesita', 'que le hace', 'descompuesto', 'descompuso', 'averiado', 'suena', 'arranca', 'prende', 'funciona'],
  },
  {
    intent: 'orders',
    keywords: ['pedido', 'orden', 'compra', 'estado', 'seguimiento', 'rastreo', 'tracking', 'llegado', 'camino', 'cuando llega', 'solicitud', 'factura'],
  },
  {
    intent: 'account',
    keywords: ['cuenta', 'perfil', 'registro', 'contrasena', 'contraseña', 'mis datos', 'actualizar', 'cambiar', 'informacion', 'email', 'correo', 'telefono'],
  },
  {
    intent: 'support',
    keywords: ['humano', 'agente', 'hablar', 'persona', 'soporte', 'ayuda', 'atencion', 'contacto', 'queja', 'reclamo', 'problema grave'],
  },
  {
    intent: 'catalog',
    keywords: ['categoria', 'categorias', 'productos', 'catalogo', 'refaccion', 'refacciones', 'pieza', 'repuesto', 'parte', 'marca', 'marcas'],
  },
];

const PRODUCT_TERMS = ['precio', 'comprar', 'necesito', 'quiero', 'busco', 'costo', 'cotizacion', 'filtro', 'freno', 'motor', 'llanta', 'aceite', 'bateria', 'alternador', 'disco', 'pastilla', 'zapata', 'sensor', 'embrague', 'amortiguador', 'radiador', 'correa', 'bomba', 'inyector', 'valvula', 'piston', 'junta', 'rodamiento', 'resorte', 'brazo', 'buje', 'cable', 'faro', 'espejo', 'parachoques', 'turbo', 'rin', 'tienen', 'venden', 'manejan'];

const CATEGORY_TERMS = ['cuanto cuesta', 'recomiendas', 'sugieres', 'tienes', 'cual', 'cuales'];

export class IntentDetector {
  static detect(message) {
    const cleaned = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?!¡,.;:()\[\]{}"]/g, '').trim();
    const stopWords = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'con', 'por', 'para', 'los', 'las', 'del', 'al', 'no', 'mi', 'tu', 'se', 'es', 'su', 'que', 'lo', 'le']);

    const allWords = cleaned.split(/\s+/).filter(w => w.length > 0);
    const contentWords = allWords.filter(w => w.length > 2 && !stopWords.has(w));

    const bigrams = [];
    for (let i = 0; i < allWords.length - 1; i++) {
      bigrams.push(allWords[i] + ' ' + allWords[i + 1]);
    }

    const phrases = [...new Set([...bigrams, ...contentWords])];

    const scores = {};

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        const kw = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        for (const phrase of phrases) {
          if (phrase === kw) {
            score += 4;
          } else if (phrase.includes(kw) || kw.includes(phrase)) {
            score += 2;
          }
        }

        if (!kw.includes(' ')) {
          for (const word of contentWords) {
            if (word === kw) {
              score += 4;
            } else if (word !== kw && word.length > 2 && kw.length > 2) {
              const dist = levenshtein(word, kw);
              const minLen = Math.min(word.length, kw.length);
              if (dist <= 1 || (dist <= 2 && minLen >= 5 && dist / minLen <= 0.3)) {
                score += 1;
              }
            }
          }
        }
      }
      if (score > 0) {
        scores[pattern.intent] = score;
      }
    }

    for (const term of PRODUCT_TERMS) {
      if (contentWords.some(w => w === term)) {
        scores.products = (scores.products || 0) + 3;
      } else if (cleaned.includes(term)) {
        scores.products = (scores.products || 0) + 2;
      }
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) return 'general';

    const topIntent = sorted[0][0];
    const topScore = sorted[0][1];

    if (topScore >= 4) return topIntent;

    for (const term of CATEGORY_TERMS) {
      if (cleaned.includes(term)) return 'products';
    }

    return topIntent;
  }
}
