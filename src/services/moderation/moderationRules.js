import { CATEGORIES } from './types.js';

const rule = (category, weight, regex, description, exclude = null) => ({
  category,
  weight,
  regex,
  description,
  exclude,
});

export const MODERATION_RULES = [
  // Las amenazas requieren una construcción amenazante explícita o un término inequívoco.
  rule(CATEGORIES.THREAT, 100, /\b(?:te\s+)?voy\s+a\s+(?:matar|asesinar)\b/, 'Amenaza directa contra una persona'),
  rule(CATEGORIES.THREAT, 100, /\bte\s+(?:matare|mato|asesinare|asesino)\b/, 'Amenaza directa contra una persona'),
  rule(CATEGORIES.THREAT, 90, /\b(?:muere|vas\s+a\s+morir)\b/, 'Deseo o amenaza de muerte'),
  rule(CATEGORIES.THREAT, 80, /\b(?:amenaza|amenazas|amenazar|amenazarte)\b/, 'Mención explícita de amenaza'),
  rule(CATEGORIES.THREAT, 70, /\b(?:se|sabemos?)\s+donde\s+vives\b/, 'Amenaza sobre la ubicación de una persona'),
  rule(CATEGORIES.THREAT, 65, /\b(?:te\s+voy\s+a\s+buscar|voy\s+por\s+ti|te\s+encontrare)\b/, 'Amenaza de persecución'),
  rule(CATEGORIES.THREAT, 90, /\b(?:te\s+)?(?:parto|rompo)\s+(?:la\s+madre|el\s+hocico)\b/, 'Amenaza de violencia física'),
  rule(CATEGORIES.THREAT, 85, /\b(?:te\s+voy\s+a\s+madrear|voy\s+a\s+golpearte|te\s+golpeo|te\s+reviento)\b/, 'Amenaza de agresión física'),
  rule(CATEGORIES.THREAT, 90, /\b(?:te\s+voy\s+a\s+desaparecer|te\s+desaparezco|te\s+voy\s+a\s+levantar|te\s+levanto)\b/, 'Amenaza grave contra una persona'),
  rule(CATEGORIES.THREAT, 70, /\b(?:afuera\s+te\s+espero|cuidate\s+la\s+espalda|cuida\s+a\s+tu\s+familia)\b/, 'Intimidación o amenaza indirecta'),
  rule(CATEGORIES.THREAT, 80, /\b(?:voy\s+a\s+quemar|le\s+prendo\s+fuego\s+a)\s+(?:la\s+)?(?:tienda|sucursal|bodega|oficina)\b/, 'Amenaza contra instalaciones'),

  // Los términos legales y regulatorios son coincidencias precisas de palabras completas.
  rule(CATEGORIES.LEGAL, 70, /\bprofeco\b/, 'Mención de PROFECO'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:demanda|demandar|demandare|demandado|demandada)\b/, 'Acción legal'),
  rule(CATEGORIES.LEGAL, 50, /\b(?:abogado|abogada|fraude|estafa)\b/, 'Riesgo legal o fraude'),
  rule(CATEGORIES.LEGAL, 45, /\b(?:juicio|querella)\b/, 'Procedimiento legal'),
  rule(CATEGORIES.LEGAL, 40, /\b(?:denuncia|denunciar|denunciare|juez|jueza)\b/, 'Denuncia o autoridad judicial'),
  rule(CATEGORIES.LEGAL, 35, /\b(?:tribunal|sentencia)\b/, 'Procedimiento judicial'),
  rule(CATEGORIES.LEGAL, 30, /\b(?:legalmente|accion\s+legal)\b/, 'Acción legal explícita'),
  rule(CATEGORIES.LEGAL, 70, /\b(?:condusef|fiscalia|ministerio\s+publico)\b/, 'Mención de autoridad o regulador'),
  rule(CATEGORIES.LEGAL, 55, /\b(?:denuncia\s+penal|demanda\s+colectiva|proceder\s+legalmente)\b/, 'Escalamiento legal explícito'),
  rule(CATEGORIES.LEGAL, 45, /\b(?:delito|responsabilidad\s+legal|carta\s+de\s+(?:mi\s+)?abogado)\b/, 'Posible controversia legal'),
  rule(CATEGORIES.LEGAL, 40, /\bcargo\s+no\s+reconocido\b/, 'Posible controversia de pago'),
  rule(CATEGORIES.LEGAL, 50, /\b(?:estafador|estafadora|estafadores|estafadoras)\b/, 'Acusación de estafa'),

  // Los insultos explícitos. Los sustantivos ambiguos como "perro" necesitan una construcción insultante.
  rule(CATEGORIES.INSULT, 35, /\b(?:hijo\s+de\s+puta|hijoputa)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 30, /\b(?:imbecil|puto|puta|zorra|hdp)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:idiota|pendejo|pendeja|estupido|estupida|burro|burra|inutil|culero|culera)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 20, /\b(?:tonto|tonta|mierda)\b/, 'Lenguaje ofensivo'),
  rule(CATEGORIES.INSULT, 18, /\b(?:chingada|chingado|chingar|pinche)\b/, 'Lenguaje ofensivo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:eres|es|son)\s+(?:un|una|unos|unas)?\s*(?:perro|perra|ladron|ladrona|mentiroso|mentirosa|estafador|estafadora)\b/, 'Insulto dirigido'),
  rule(CATEGORIES.INSULT, 30, /\b(?:baboso|babosa|tarado|tarada|retrasado|retrasada|pendejazo|pendejaza)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:menso|mensa|mamon|mamona|cabron|cabrona|ojete|pelmazo|pelmaza)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 35, /\b(?:chinga\s+tu\s+madre|vete\s+(?:a\s+la\s+chingada|al\s+carajo)|que\s+te\s+chinguen)\b/, 'Agresión verbal directa'),
  rule(CATEGORIES.INSULT, 30, /\b(?:no\s+sirves\s+para\s+nada|eres\s+una\s+basura|pedazo\s+de\s+(?:idiota|imbecil|mierda))\b/, 'Descalificación dirigida'),
  rule(CATEGORIES.INSULT, 20, /\b(?:aprende\s+a\s+leer|usa\s+el\s+cerebro|no\s+sabes\s+nada)\b/, 'Descalificación dirigida'),
  rule(CATEGORIES.INSULT, 35, /\b(?:hdtpm|hdptm|hdsptm|hijo\s+de\s+tu\s+puta\s+madre)\b/, 'Insulto directo abreviado'),
  rule(CATEGORIES.INSULT, 30, /\b(?:putito|putita|putitos|putitas|pendejito|pendejita)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 20, /\b(?:chafa|mediocre|incompetentes?)\b/, 'Descalificación del servicio o personal'),
  rule(CATEGORIES.INSULT, 20, /\b(?:no\s+la\s+arman|no\s+dan\s+una|son\s+unos\s+inutiles)\b/, 'Descalificación dirigida'),

  // Contenido sexual. "Me/te/le toca" no está incluido intencionalmente.
  rule(CATEGORIES.SEXUAL, 80, /\b(?:violacion|violar|violarte)\b/, 'Violencia sexual'),
  rule(CATEGORIES.SEXUAL, 70, /\b(?:abuso|abusar|abusarte)\s+sexual\b/, 'Abuso sexual'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:quiero\s+tocarte|voy\s+a\s+tocarte|te\s+voy\s+a\s+tocar|tocarte|tocame)\b/, 'Contacto sexual dirigido'),
  rule(CATEGORIES.SEXUAL, 35, /\bacoso\s+sexual\b/, 'Acoso sexual'),
  rule(CATEGORIES.SEXUAL, 30, /\b(?:contenido|acto|acoso)\s+sexual\b/, 'Contenido sexual explícito'),
  rule(CATEGORIES.SEXUAL, 25, /\b(?:sexo|sexualmente)\b/, 'Contenido sexual explícito'),
  rule(CATEGORIES.SEXUAL, 55, /\b(?:mandame|enviame|pasame)\s+(?:nudes|fotos?\s+(?:desnuda|desnudo|intimas?))\b/, 'Solicitud de contenido sexual'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:quiero\s+verte|te\s+quiero\s+ver)\s+(?:desnuda|desnudo)\b/, 'Solicitud sexual dirigida'),
  rule(CATEGORIES.SEXUAL, 35, /\b(?:estas|te\s+ves)\s+(?:bien\s+)?(?:buena|bueno|sexy)\b/, 'Comentario sexual dirigido'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:que\s+rico\s+cuerpo|quiero\s+tu\s+cuerpo|ensen[a-z]*\s+el\s+cuerpo)\b/, 'Comentario sexual explícito'),

  // El acoso requiere conducta dirigida a una persona, no usos comunes de "seguir".
  rule(CATEGORIES.HARASSMENT, 65, /\b(?:acosar|acosarte|acoso)\b/, 'Acoso explícito'),
  rule(CATEGORIES.HARASSMENT, 55, /\b(?:te\s+voy\s+a\s+seguir|voy\s+a\s+perseguirte|te\s+estoy\s+vigilando|voy\s+a\s+espiarte)\b/, 'Persecución dirigida'),
  rule(CATEGORIES.HARASSMENT, 65, /\bno\s+te\s+voy\s+a\s+dejar\s+en\s+paz\b/, 'Hostigamiento persistente'),
  rule(CATEGORIES.HARASSMENT, 60, /\b(?:te\s+llamare|te\s+voy\s+a\s+llamar)\s+hasta\s+que\s+(?:contestes|respondas)\b/, 'Contacto insistente'),
  rule(CATEGORIES.HARASSMENT, 70, /\b(?:se|conozco)\s+donde\s+(?:trabajas|estudias)\b/, 'Intimidación mediante información personal'),
  rule(CATEGORIES.HARASSMENT, 65, /\bvoy\s+a\s+ir\s+a\s+tu\s+(?:casa|trabajo|oficina)\s+(?:a\s+buscarte|aunque\s+no\s+quieras|para\s+enfrentarte)\b/, 'Acercamiento intimidatorio'),
  rule(CATEGORIES.HARASSMENT, 60, /\b(?:llevo\s+dias\s+siguiendote|te\s+he\s+estado\s+siguiendo)\b/, 'Seguimiento persistente'),

  // Las etiquetas de odio solo se emiten para ideología explícita o degradation dirigida.
  rule(CATEGORIES.HATE, 50, /\b(?:nazi|nazismo)\b/, 'Ideología de odio'),
  rule(CATEGORIES.HATE, 40, /\b(?:racista|racismo)\b/, 'Racismo explícito'),
  rule(CATEGORIES.HATE, 30, /\b(?:eres|es|son)\s+(?:un|una|unos|unas)?\s*(?:negro|negra|indio|india|gordo|gorda|feo|fea|sucio|sucia|asqueroso|asquerosa)\b/, 'Ataque dirigido por identidad o apariencia'),
  rule(
    CATEGORIES.HATE,
    50,
    /\b(?:naco|naca|nacos|nacas|naquito|naquita|naquitos|naquitas|prieto|prieta|prietos|prietas|sudaca|sudacas)\b/,
    'Insulto clasista, racial o xenófobo',
    /\b(?:color|tono|pintura|pieza)\s+(?:prieto|prieta|prietos|prietas)\b/
  ),
  rule(CATEGORIES.HATE, 50, /\b(?:indio|india|indios|indias|chango|changa)\s+(?:ignorante|asqueroso|asquerosa|muerto\s+de\s+hambre)\b/, 'Ataque discriminatorio dirigido'),
  rule(CATEGORIES.HATE, 55, /\b(?:regresate|vete)\s+a\s+tu\s+(?:pais|rancho|pueblo)\b/, 'Ataque xenófobo o clasista'),
  rule(CATEGORIES.HATE, 45, /\b(?:por\s+ser|por\s+verte)\s+(?:negro|negra|indio|india|prieto|prieta|gordo|gorda)\b/, 'Ataque por identidad o apariencia'),
  rule(CATEGORIES.HATE, 45, /\b(?:maricon|joto|jota|marimacha)\b/, 'Insulto por orientación o expresión de género'),
  rule(CATEGORIES.HATE, 35, /\b(?:muerto|muerta)\s+de\s+hambre\b/, 'Insulto clasista'),
  rule(CATEGORIES.HATE, 50, /\b(?:gente\s+como\s+tu|los\s+de\s+tu\s+tipo)\s+no\s+(?:deberian|merecen)\b/, 'Expresión discriminatoria'),

  // Clasificación operativa de conversaciones.
  rule(CATEGORIES.CUSTOMER_RISK, 30, /\b(?:perdieron\s+un\s+cliente|no\s+vuelvo\s+a\s+comprar|voy\s+a\s+cancelar\s+(?:mi\s+)?compra)\b/, 'Riesgo de pérdida del cliente'),
  rule(CATEGORIES.CUSTOMER_RISK, 25, /\b(?:estoy\s+hart[oa]|ya\s+me\s+canse|esto\s+es\s+una\s+verguenza|pesimo\s+servicio)\b/, 'Cliente muy inconforme'),
  rule(CATEGORIES.CUSTOMER_RISK, 20, /\b(?:es\s+la\s+(?:segunda|tercera|cuarta)\s+vez|nadie\s+(?:me\s+)?responde|siempre\s+es\s+lo\s+mismo|llevo\s+(?:dias|semanas|meses)\s+esperando)\b/, 'Problema reiterado o sin respuesta'),

  rule(CATEGORIES.URGENCY, 25, /\b(?:es\s+urgente|me\s+urge|lo\s+necesito\s+(?:hoy|ahora)|ahora\s+mismo)\b/, 'Solicitud urgente'),
  rule(CATEGORIES.URGENCY, 20, /\b(?:urgente|inmediatamente|de\s+inmediato|cuanto\s+antes)\b/, 'Urgencia explícita'),
  rule(CATEGORIES.URGENCY, 15, /^(?:ya|ahora|hoy)$/, 'Urgencia breve explícita'),

  rule(CATEGORIES.PAYMENT_RISK, 60, /\b(?:me\s+cobraron\s+dos\s+veces|cobro\s+duplicado|cargo\s+duplicado)\b/, 'Cobro duplicado'),
  rule(CATEGORIES.PAYMENT_RISK, 55, /\b(?:no\s+reconozco\s+(?:el|este)\s+cargo|cargo\s+no\s+reconocido|me\s+descontaron\s+dinero)\b/, 'Cargo o descuento cuestionado'),
  rule(CATEGORIES.PAYMENT_RISK, 40, /\b(?:stripe\s+me\s+cobro|mi\s+tarjeta\s+fue\s+rechazada|pago\s+rechazado|pago\s+declinado)\b/, 'Incidencia de pago'),

  rule(CATEGORIES.REFUND, 35, /\b(?:quiero|solicito|necesito)\s+(?:una\s+)?devolucion\b/, 'Solicitud de devolución'),
  rule(CATEGORIES.REFUND, 35, /\b(?:quiero\s+mi\s+dinero|devuelvanme\s+(?:mi\s+)?dinero|quiero\s+un\s+reembolso)\b/, 'Solicitud de devolución de dinero'),
  rule(CATEGORIES.REFUND, 25, /\b(?:reembolso|devolucion|devolver\s+el\s+producto)\b/, 'Consulta de devolución o reembolso'),
  rule(CATEGORIES.REFUND, 25, /\bdevuelvanme\b/, 'Solicitud de devolución'),

  rule(CATEGORIES.FRAUD_REPORT, 70, /\b(?:me\s+estafaron|son\s+estafadores|es\s+un\s+fraude|robaron\s+mi\s+dinero)\b/, 'Reporte explícito de fraude'),
  rule(CATEGORIES.FRAUD_REPORT, 55, /\b(?:esto\s+es\s+una\s+estafa|me\s+robaron|empresa\s+fraudulenta)\b/, 'Acusación de fraude'),

  rule(CATEGORIES.CHARGEBACK, 75, /\b(?:voy\s+a\s+desconocer\s+(?:el|este)\s+cargo|desconocere\s+(?:el|este)\s+cargo|chargeback|contracargo)\b/, 'Riesgo de contracargo'),
  rule(CATEGORIES.CHARGEBACK, 45, /\b(?:hablare|voy\s+a\s+hablar)\s+con\s+(?:mi\s+)?banco\b/, 'Escalamiento con el banco'),

  rule(CATEGORIES.ACCOUNT, 15, /\b(?:no\s+puedo\s+iniciar\s+sesion|no\s+puedo\s+entrar|olvide\s+mi\s+contrasena|no\s+llega\s+(?:el|mi)\s+codigo)\b/, 'Problema de acceso a la cuenta'),
  rule(CATEGORIES.ACCOUNT, 10, /\b(?:mi\s+cuenta|iniciar\s+sesion|recuperar\s+(?:mi\s+)?contrasena)\b/, 'Consulta de cuenta'),

  rule(CATEGORIES.ORDER, 15, /\b(?:mi\s+pedido|mi\s+orden)\s+(?:no\s+llega|no\s+aparece|esta\s+retrasad[oa]|esta\s+incomplet[oa])\b/, 'Incidencia con un pedido'),
  rule(CATEGORIES.ORDER, 15, /^(?:no\s+llega|no\s+aparece)$/, 'Incidencia con un pedido'),
  rule(CATEGORIES.ORDER, 5, /\b(?:mi\s+pedido|mi\s+orden|numero\s+de\s+pedido|estado\s+del\s+pedido)\b/, 'Consulta de pedido'),
  rule(CATEGORIES.PAYMENT, 5, /\b(?:pago|tarjeta|transferencia|deposito|visa|mastercard|amex)\b/, 'Consulta de pago'),
  rule(CATEGORIES.CRYPTO, 10, /\b(?:bitcoin|cripto|criptomoneda|invierte\s+en\s+cripto)\b/, 'Mención de criptomonedas'),
  rule(CATEGORIES.PROMOTION, 5, /\b(?:oferta|descuento|promo|promocion|cupon)\b/, 'Consulta promocional'),
];
