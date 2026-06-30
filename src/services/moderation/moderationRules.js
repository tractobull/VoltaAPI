import { CATEGORIES } from './types.js';

const rule = (category, weight, regex, description, exclude = null) => ({
  category,
  weight,
  regex,
  description,
  exclude,
});

export const MODERATION_RULES = [
  // ===== AMENAZAS =====
  rule(CATEGORIES.THREAT, 100, /\b(?:te\s+)?voy\s+a\s+(?:matar|asesinar|ejecutar|eliminar|tronar|quebrar)\b/, 'Amenaza directa contra una persona'),
  rule(CATEGORIES.THREAT, 100, /\bte\s+(?:matare|mato|asesinare|asesino|ejecuto|elimino|trono|quiebro)\b/, 'Amenaza directa contra una persona'),
  rule(CATEGORIES.THREAT, 95, /\b(?:quiero\s+matarte|te\s+quiero\s+matar|voy\s+a\s+acabar\s+contigo|te\s+voy\s+a\s+acabar)\b/, 'Amenaza de muerte explícita'),
  rule(CATEGORIES.THREAT, 90, /\b(?:muere|muérete|vas\s+a\s+morir|te\s+vas\s+a\s+morir|te\s+mueres|ojala\s+te\s+mueras)\b/, 'Deseo o amenaza de muerte'),
  rule(CATEGORIES.THREAT, 85, /\b(?:te\s+voy\s+a\s+(?:destruir|aniquilar|hacer\s+picadillo|hacer\s+pedazos))\b/, 'Amenaza de daño extremo'),
  rule(CATEGORIES.THREAT, 80, /\b(?:amenaza|amenazas|amenazar|amenazarte|amenazando|amenazare)\b/, 'Mención explícita de amenaza'),
  rule(CATEGORIES.THREAT, 70, /\b(?:se|sabemos?|conozco|conozco\s+bien)\s+donde\s+(?:vives|viven|trabajas|estudias|andas)\b/, 'Amenaza sobre ubicación de una persona'),
  rule(CATEGORIES.THREAT, 65, /\b(?:te\s+voy\s+a\s+(?:buscar|encontrar|cazar|agarrar|pescar)|voy\s+por\s+ti|te\s+(?:encontrare|buscare|cazare|agarrare))\b/, 'Amenaza de persecución'),
  rule(CATEGORIES.THREAT, 90, /\b(?:te\s+)?(?:parto|rompo|quiebro|trueno)\s+(?:la\s+madre|el\s+hocico|la\s+cara|el\s+osico|la\s+boca|toda\s+la\s+cara)\b/, 'Amenaza de violencia física'),
  rule(CATEGORIES.THREAT, 85, /\b(?:te\s+voy\s+a\s+(?:madrear|golpear|reventar|fajar|dar\s+un\s+levant[oó]n|poner\s+una\s+calentada)|te\s+(?:golpeo|reviento|fajo|madreo))\b/, 'Amenaza de agresión física'),
  rule(CATEGORIES.THREAT, 90, /\b(?:te\s+voy\s+a\s+(?:desaparecer|levantar|secuestrar|raptar|callar\s+para\s+siempre)|te\s+(?:desaparezco|levanto|secuestro|rapto))\b/, 'Amenaza grave contra una persona'),
  rule(CATEGORIES.THREAT, 70, /\b(?:afuera\s+te\s+espero|cuidate\s+la\s+espalda|cuida\s+a\s+tu\s+familia|nos\s+vamos\s+a\s+ver\s+las\s+caras|te\s+voy\s+a\s+dar\s+un\s+susto)\b/, 'Intimidación o amenaza indirecta'),
  rule(CATEGORIES.THREAT, 80, /\b(?:voy\s+a\s+(?:quemar|incendiar|destruir|atacar)\s+(?:la\s+)?(?:tienda|sucursal|bodega|oficina|negocio|local|establecimiento))\b/, 'Amenaza contra instalaciones'),
  rule(CATEGORIES.THREAT, 75, /\b(?:te\s+voy\s+a\s+(?:meter\s+un\s+susto|dar\s+un\s+escarmiento|dar\s+tu\s+merecido)|vas\s+a\s+pagar\s+por\s+esto)\b/, 'Amenaza de represalia'),
  rule(CATEGORIES.THREAT, 80, /\b(?:con\s+una\s+mano\s+en\s+la\s+cintura|ando\s+armado|tengo\s+con\s+que\s+defenderme)\b/, 'Insinuación de portación de armas'),

  // ===== LEGAL (CORREGIDO - Mayor precisión para evitar falsos positivos) =====
  // Solo detecta acciones concretas, NO preguntas informativas
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+ir\s+(?:a|con)\s+profeco|ire\s+(?:a|con)\s+profeco|acudire\s+a\s+profeco|me\s+presentare\s+en\s+profeco)\b/, 'Intención de acudir a PROFECO'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+reportar(?:los)?\s+a\s+profeco|los\s+voy\s+a\s+reportar\s+a\s+profeco|reportare\s+a\s+profeco|levantare\s+un\s+reporte\s+en\s+profeco)\b/, 'Reporte a PROFECO'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+denunciar(?:los)?\s+en\s+profeco|denunciare\s+en\s+profeco|presentare\s+una\s+queja\s+en\s+profeco|interpondre\s+una\s+queja\s+en\s+profeco)\b/, 'Denuncia ante PROFECO'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:nos\s+vemos\s+en\s+profeco|alli\s+nos\s+vemos\s+en\s+profeco|te\s+veo\s+en\s+profeco)\b/, 'Advertencia de encuentro en PROFECO'),
  rule(CATEGORIES.LEGAL, 70, /\b(?:profeco\s+ya\s+(?:esta\s+enterada|tiene\s+mi\s+caso|abrio\s+mi\s+caso|está\s+investigando|me\s+dio\s+la\s+razon)|ya\s+(?:levante|presente|interpuse|meti)\s+una\s+queja\s+en\s+profeco)\b/, 'Caso ya escalado a PROFECO'),
  rule(CATEGORIES.LEGAL, 50, /\b(?:queja|reclamo)\s+en\s+profeco\b/, 'Queja ante PROFECO'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:nos\s+vemos\s+en\s+profeco|alli\s+nos\s+vemos\s+en\s+profeco|te\s+veo\s+en\s+profeco)\b/, 'Advertencia de encuentro en PROFECO'),
  rule(CATEGORIES.LEGAL, 25, /\bprofeco\b/, 'Mención de PROFECO', /\b(?:que\s+(?:es|significa|hace)|como\s+(?:funciona|trabaja)|quien(?:es)?\s+(?:es|son)|cual\s+es)\s+profeco\b/),
  
  rule(CATEGORIES.LEGAL, 60, /\b(?:demandar(?:los|te|me|los|las)?|los\s+voy\s+a\s+demandar|te\s+voy\s+a\s+demandar|demandare|demandaremos)\b/, 'Intención de demanda'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+proceder\s+legalmente|procedere\s+legalmente|accion\s+legal|acciones\s+legales|via\s+legal)\b/, 'Escalamiento legal'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:derechos?\s+del\s+consumidor|ley\s+federal\s+de\s+proteccion\s+al\s+consumidor|ley\s+de\s+proteccion)\b/, 'Referencia a legislación'),
  rule(CATEGORIES.LEGAL, 55, /\b(?:voy\s+a\s+levantar\s+una\s+denuncia|levantare\s+una\s+denuncia|pondre\s+una\s+denuncia|interpondre\s+una\s+denuncia)\b/, 'Denuncia formal'),
  rule(CATEGORIES.LEGAL, 55, /\b(?:denunciare|los\s+voy\s+a\s+denunciar|te\s+voy\s+a\s+denunciar|denunciaremos)\b/, 'Intención de denunciar'),
  rule(CATEGORIES.LEGAL, 35, /\bdenuncia\b/, 'Mención de denuncia'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+poner|quiero\s+poner|pienso\s+poner|voy\s+a\s+levantar|quiero\s+levantar|voy\s+a\s+presentar|quiero\s+presentar|voy\s+a\s+interponer|quiero\s+interponer|voy\s+a\s+iniciar|quiero\s+iniciar|voy\s+a\s+proceder\s+con)\s+una\s+denuncia\b/, 'Intención de presentar una denuncia'),
  rule(CATEGORIES.LEGAL, 50, /\b(?:incumplimiento\s+de\s+contrato|incumplieron\s+el\s+contrato|rompieron\s+el\s+contrato|violaron\s+el\s+contrato)\b/, 'Incumplimiento contractual'),
  rule(CATEGORIES.LEGAL, 50, /\b(?:incumplimiento\s+de\s+garantia|garantia\s+legal|garantia\s+no\s+cubierta|violacion\s+de\s+garantia)\b/, 'Garantía legal'),
  rule(CATEGORIES.LEGAL, 45, /\b(?:indemnizacion|danos?\s+y\s+perjuicios|danos?\s+morales|compensacion\s+economica)\b/, 'Reclamación económica'),
  rule(CATEGORIES.LEGAL, 45, /\b(?:citatorio|notificacion\s+judicial|orden\s+judicial|juzgado|tribunal)\b/, 'Documento o instancia judicial'),
  rule(CATEGORIES.LEGAL, 45, /\b(?:despacho\s+juridico|representante\s+legal|abogado|licenciado\s+en\s+derecho|asesor\s+legal)\b/, 'Representación legal'),
  rule(CATEGORIES.LEGAL, 40, /\b(?:contrato|clausulas?|terminos?\s+contractuales?|acuerdo\s+firmado)\b/, 'Consulta contractual'),
  rule(CATEGORIES.LEGAL, 40, /\b(?:terminos\s+y\s+condiciones|aviso\s+de\s+privacidad|politicas?\s+de\s+privacidad)\b/, 'Documento legal'),
  rule(CATEGORIES.LEGAL, 40, /\b(?:propiedad\s+intelectual|derechos?\s+de\s+autor|marca\s+registrada|patente|copyright)\b/, 'Propiedad intelectual'),
  rule(CATEGORIES.LEGAL, 40, /\b(?:arbitraje|mediacion|conciliacion|resolucion\s+alternativa|junta\s+de\s+conciliacion)\b/, 'Mecanismo de resolución de conflictos'),
  rule(CATEGORIES.LEGAL, 35, /\b(?:evidencia|pruebas?|documentar\s+el\s+caso|capturas?\s+de\s+pantalla)\b/, 'Preparación de evidencia'),
  rule(CATEGORIES.LEGAL, 35, /\b(?:peritaje|dictamen|perito|valuador)\b/, 'Procedimiento pericial'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:condusef|fiscalia|ministerio\s+publico|mp|policia\s+cibernetica|guardia\s+nacional)\b/, 'Mención de autoridad'),
  rule(CATEGORIES.LEGAL, 60, /\b(?:voy\s+a\s+ir\s+(?:a|con)\s+(?:condusef|fiscalia|ministerio\s+publico|mp|policia))\b/, 'Intención de acudir a una autoridad'),

  // ===== INSULTOS =====
  rule(CATEGORIES.INSULT, 35, /\b(?:hijo\s+de\s+(?:puta|perra|la\s+chingada)|hijoputa|hijueputa|hijuesuputamadre)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 30, /\b(?:imbecil|puto|puta|zorra|hdp|cerdo|cerda|marrano|marrana)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:idiota|pendejo|pendeja|estupido|estupida|burro|burra|inutil|culero|culera|estupidazo|estupidaza)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 20, /\b(?:tonto|tonta|mierda|basura|porqueria|mediocre)\b/, 'Lenguaje ofensivo'),
  rule(CATEGORIES.INSULT, 18, /\b(?:chingada|chingado|chingar|pinche|joder|jodido|jodida|carajo|diablos)\b/, 'Lenguaje ofensivo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:eres|es|son|sois|somos)\s+(?:un|una|unos|unas)?\s*(?:perro|perra|ladron|ladrona|mentiroso|mentirosa|estafador|estafadora|rata|ratero|ratera|delincuente)\b/, 'Insulto dirigido'),
  rule(CATEGORIES.INSULT, 30, /\b(?:baboso|babosa|tarado|tarada|retrasado|retrasada|pendejazo|pendejaza|animal|bestia|estupido\s+mental)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 25, /\b(?:menso|mensa|mamon|mamona|cabron|cabrona|ojete|pelmazo|pelmaza|patan|patana|grosero|grosera)\b/, 'Insulto directo'),
  rule(CATEGORIES.INSULT, 35, /\b(?:chinga\s+tu\s+madre|vete\s+(?:a\s+la\s+chingada|al\s+carajo|a\s+la\s+verga|al\s+diablo)|que\s+te\s+(?:chinguen|jodan|pudras))\b/, 'Agresión verbal directa'),
  rule(CATEGORIES.INSULT, 30, /\b(?:no\s+sirves\s+para\s+nada|eres\s+una\s+basura|pedazo\s+de\s+(?:idiota|imbecil|mierda|basura|animal)|eres\s+un\s+inutil)\b/, 'Descalificación dirigida'),
  rule(CATEGORIES.INSULT, 20, /\b(?:aprende\s+a\s+leer|usa\s+el\s+cerebro|no\s+sabes\s+nada|no\s+tienes\s+idea|ponte\s+a\s+trabajar)\b/, 'Descalificación dirigida'),
  rule(CATEGORIES.INSULT, 35, /\b(?:hdtpm|hdptm|hdsptm|hijo\s+de\s+tu\s+puta\s+madre|chingatumadre|chinga\s+tu\s+madre)\b/, 'Insulto directo abreviado'),
  rule(CATEGORIES.INSULT, 30, /\b(?:putito|putita|putitos|putitas|pendejito|pendejita|culerito|culerita|mamoncito|mamoncita)\b/, 'Insulto directo diminutivo'),
  rule(CATEGORIES.INSULT, 20, /\b(?:chafa|mediocre|incompetentes?|ineptos?|inservibles?|no\s+valen\s+para\s+nada)\b/, 'Descalificación del servicio o personal'),
  rule(CATEGORIES.INSULT, 20, /\b(?:no\s+la\s+arman|no\s+dan\s+una|son\s+unos\s+inutiles|son\s+una\s+porqueria|peor\s+servicio\s+que\s+he\s+visto)\b/, 'Descalificación dirigida'),
  rule(CATEGORIES.INSULT, 25, /\b(?:callate|callese|cállate|cállese|cierra\s+el\s+osico|cierra\s+la\s+boca|no\s+digas\s+mamadas)\b/, 'Orden despectiva'),

  // ===== CONTENIDO SEXUAL =====
  rule(CATEGORIES.SEXUAL, 80, /\b(?:violacion|violar|violarte|violada|violador|abuso\s+sexual|agresion\s+sexual)\b/, 'Violencia sexual'),
  rule(CATEGORIES.SEXUAL, 70, /\b(?:abuso|abusar|abusarte)\s+sexual\b/, 'Abuso sexual'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:quiero\s+tocarte|voy\s+a\s+tocarte|te\s+voy\s+a\s+tocar|tocarte|tocame|acariciarte|besarte\s+a\s+fuerza)\b/, 'Contacto sexual dirigido'),
  rule(CATEGORIES.SEXUAL, 35, /\bacoso\s+sexual\b/, 'Acoso sexual'),
  rule(CATEGORIES.SEXUAL, 30, /\b(?:contenido|acto|acoso|insinuacion|proposicion)\s+sexual\b/, 'Contenido sexual explícito'),
  rule(CATEGORIES.SEXUAL, 25, /\b(?:sexo|sexualmente|sexual|erotico|erotica|porno|pornografia|pornografico)\b/, 'Contenido sexual explícito'),
  rule(CATEGORIES.SEXUAL, 55, /\b(?:mandame|enviame|pasame|comparteme|muestrame)\s+(?:nudes|fotos?\s+(?:desnuda|desnudo|intimas?|sin\s+ropa|encuerada|encuerado))\b/, 'Solicitud de contenido sexual'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:quiero\s+verte|te\s+quiero\s+ver|me\s+gustaria\s+verte)\s+(?:desnuda|desnudo|sin\s+ropa|encuerada|encuerado)\b/, 'Solicitud sexual dirigida'),
  rule(CATEGORIES.SEXUAL, 35, /\b(?:estas|te\s+ves|te\s+miras)\s+(?:bien\s+)?(?:buena|bueno|sexy|sensual|rica|rico|cuerazo|papasito|mamasita)\b/, 'Comentario sexual dirigido'),
  rule(CATEGORIES.SEXUAL, 45, /\b(?:que\s+rico\s+cuerpo|quiero\s+tu\s+cuerpo|ensen[a-z]*\s+el\s+cuerpo|que\s+bien\s+te\s+ves|me\s+excitas|me\s+pones\s+caliente)\b/, 'Comentario sexual explícito'),
  rule(CATEGORIES.SEXUAL, 40, /\b(?:prostitucion|prostituta|prostituto|puta|puto|ramera|golfo|golfa)\b/, 'Términos sexuales ofensivos'),
  rule(CATEGORIES.SEXUAL, 35, /\b(?:acostarte\s+conmigo|quiero\s+acostarme\s+contigo|tener\s+relaciones|tener\s+sexo)\b/, 'Proposición sexual directa'),
  rule(CATEGORIES.SEXUAL, 50, /\b(?:manosear|manosearte|sobarte|sobarte\s+el\s+cuerpo|meterte\s+mano)\b/, 'Contacto sexual no consentido'),

  // ===== ACOSO =====
  rule(CATEGORIES.HARASSMENT, 65, /\b(?:acosar|acosarte|acoso|hostigar|hostigarte|hostigamiento|intimidar|intimidarte)\b/, 'Acoso explícito'),
  rule(CATEGORIES.HARASSMENT, 55, /\b(?:te\s+voy\s+a\s+seguir|voy\s+a\s+perseguirte|te\s+estoy\s+vigilando|voy\s+a\s+espiarte|te\s+tengo\s+ubicada|te\s+tengo\s+ubicado)\b/, 'Persecución dirigida'),
  rule(CATEGORIES.HARASSMENT, 65, /\bno\s+te\s+voy\s+a\s+dejar\s+en\s+paz\b/, 'Hostigamiento persistente'),
  rule(CATEGORIES.HARASSMENT, 60, /\b(?:te\s+llamare|te\s+voy\s+a\s+llamar|te\s+estare\s+llamando)\s+hasta\s+que\s+(?:contestes|respondas|me\s+atiendas)\b/, 'Contacto insistente'),
  rule(CATEGORIES.HARASSMENT, 70, /\b(?:se|conozco|se\s+bien)\s+donde\s+(?:trabajas|estudias|vives|andas|te\s+mueves)\b/, 'Intimidación mediante información personal'),
  rule(CATEGORIES.HARASSMENT, 65, /\bvoy\s+a\s+ir\s+a\s+tu\s+(?:casa|trabajo|oficina|escuela)\s+(?:a\s+buscarte|aunque\s+no\s+quieras|para\s+enfrentarte|para\s+arreglar\s+esto)\b/, 'Acercamiento intimidatorio'),
  rule(CATEGORIES.HARASSMENT, 60, /\b(?:llevo\s+(?:dias|semanas|meses)\s+siguiendote|te\s+he\s+estado\s+siguiendo|no\s+he\s+dejado\s+de\s+buscarte)\b/, 'Seguimiento persistente'),
  rule(CATEGORIES.HARASSMENT, 50, /\b(?:tengo\s+capturas\s+de\s+todo|he\s+guardado\s+todos\s+tus\s+mensajes|tengo\s+evidencia\s+de\s+todo)\b/, 'Recopilación de información personal'),
  rule(CATEGORIES.HARASSMENT, 55, /\b(?:voy\s+a\s+hacer\s+que\s+te\s+despidan|voy\s+a\s+hablar\s+con\s+tu\s+jefe|voy\s+a\s+exponerte)\b/, 'Amenaza de exposición o represalia laboral'),

  // ===== DISCURSO DE ODIO =====
  rule(CATEGORIES.HATE, 50, /\b(?:nazi|nazismo|fascista|fascismo|supremacista|supremacismo)\b/, 'Ideología de odio'),
  rule(CATEGORIES.HATE, 40, /\b(?:racista|racismo|xenofobo|xenofobia|homofobo|homofobia|clasista|clasismo|machista|machismo)\b/, 'Discriminación explícita'),
  rule(CATEGORIES.HATE, 30, /\b(?:eres|es|son|sois)\s+(?:un|una|unos|unas)?\s*(?:negro|negra|indio|india|gordo|gorda|feo|fea|sucio|sucia|asqueroso|asquerosa|mugroso|mugrosa)\b/, 'Ataque dirigido por identidad o apariencia'),
  rule(
    CATEGORIES.HATE,
    50,
    /\b(?:naco|naca|nacos|nacas|naquito|naquita|naquitos|naquitas|prieto|prieta|prietos|prietas|sudaca|sudacas|panchito|panchita|gabacho|gabacha)\b/,
    'Insulto clasista, racial o xenófobo',
    /\b(?:color|tono|pintura|pieza|objeto|cosa)\s+(?:prieto|prieta|prietos|prietas)\b/
  ),
  rule(CATEGORIES.HATE, 50, /\b(?:indio|india|indios|indias|chango|changa)\s+(?:ignorante|asqueroso|asquerosa|muerto\s+de\s+hambre|hambriento|hambrienta|sucio|sucia)\b/, 'Ataque discriminatorio dirigido'),
  rule(CATEGORIES.HATE, 55, /\b(?:regresate|vete|largate|vuelvete|devuelvete)\s+a\s+tu\s+(?:pais|rancho|pueblo|tierra|cerro)\b/, 'Ataque xenófobo o clasista'),
  rule(CATEGORIES.HATE, 45, /\b(?:por\s+ser|por\s+verte|por\s+parecer)\s+(?:negro|negra|indio|india|prieto|prieta|gordo|gorda|pobre|jodido|jodida)\b/, 'Ataque por identidad o apariencia'),
  rule(CATEGORIES.HATE, 45, /\b(?:maricon|joto|jota|marimacha|tortillera|lencha|travieso|travesti\s+asqueroso)\b/, 'Insulto por orientación o expresión de género'),
  rule(CATEGORIES.HATE, 35, /\b(?:muerto|muerta)\s+de\s+hambre\b/, 'Insulto clasista'),
  rule(CATEGORIES.HATE, 50, /\b(?:gente\s+como\s+tu|los\s+de\s+tu\s+tipo|personas\s+como\s+tu)\s+(?:no\s+deberian|no\s+merecen|son\s+un\s+asco|deberian\s+desaparecer)\b/, 'Expresión discriminatoria'),
  rule(CATEGORIES.HATE, 40, /\b(?:maldito|maldita|malditos|malditas)\s+(?:negro|negra|indio|india|pobre|jodido|jodida|discapacitado|discapacitada)\b/, 'Insulto discriminatorio'),
  rule(CATEGORIES.HATE, 45, /\b(?:todos\s+los\s+[a-záéíóúñ]+\s+son\s+(?:iguales|unos\s+[a-záéíóúñ]+|una\s+porqueria))\b/, 'Generalización discriminatoria'),

  // ===== RIESGO DE CLIENTE (CORREGIDO - Cobertura ampliada) =====
  rule(CATEGORIES.CUSTOMER_RISK, 30, /\b(?:perdieron\s+un\s+cliente|no\s+vuelvo\s+a\s+comprar|voy\s+a\s+cancelar\s+(?:mi\s+)?compra|me\s+cambio\s+de\s+proveedor)\b/, 'Riesgo de pérdida del cliente'),
  rule(CATEGORIES.CUSTOMER_RISK, 30, /\b(?:no\s+(?:pienso|penso|voy\s+a)\s+seguir\s+comprando|no\s+compro\s+m[áa]s|dejo\s+de\s+comprar|abandono\s+el\s+servicio)\b/, 'Intención de abandono'),
  rule(CATEGORIES.CUSTOMER_RISK, 25, /\b(?:estoy\s+hart[oa]|ya\s+me\s+canse|esto\s+es\s+una\s+verguenza|p[ée]simo\s+servicio|deplorable\s+servicio|servicio\s+p[ée]simo)\b/, 'Cliente muy inconforme'),
  rule(CATEGORIES.CUSTOMER_RISK, 20, /\b(?:es\s+la\s+(?:segunda|tercera|cuarta|quinta|enésima)\s+vez|nadie\s+(?:me\s+)?responde|siempre\s+es\s+lo\s+mismo|llevo\s+(?:dias|semanas|meses)\s+esperando)\b/, 'Problema reiterado o sin respuesta'),
  rule(CATEGORIES.CUSTOMER_RISK, 25, /\b(?:me\s+tienen\s+hasta\s+la\s+madre|estoy\s+hasta\s+la\s+madre|me\s+estan\s+haciendo\s+enojar)\b/, 'Cliente extremadamente molesto'),
  rule(CATEGORIES.CUSTOMER_RISK, 20, /\b(?:voy\s+a\s+dejar\s+una\s+mala\s+reseña|voy\s+a\s+quemarlos\s+en\s+redes|los\s+voy\s+a\s+exponer\s+en\s+facebook)\b/, 'Amenaza de exposición pública'),
  rule(CATEGORIES.CUSTOMER_RISK, 15, /\b(?:nunca\s+mas\s+compro\s+aqui|jamas\s+vuelvo|ultima\s+vez\s+que\s+compro)\b/, 'Pérdida definitiva del cliente'),
  rule(CATEGORIES.CUSTOMER_RISK, 30, /\b(?:no\s+(?:pienso|penso|voy\s+a)\s+seguir\s+comprando|no\s+compro\s+m[áa]s|dejo\s+de\s+comprar|abandono\s+el\s+servicio)\b/, 'Intención de abandono'),
  rule(CATEGORIES.CUSTOMER_RISK, 10, /\b(?:no\s+sirve|no\s+funciona|esta\s+fallando|no\s+carga|se\s+traba)\s+(?:la\s+)?(?:app|aplicacion|pagina|plataforma|sistema|producto)\b/, 'Falla técnica reportada'),

  // ===== URGENCIA =====
  rule(CATEGORIES.URGENCY, 25, /\b(?:es\s+urgente|me\s+urge|lo\s+necesito\s+(?:hoy|ahora|ya|para\s+ayer)|ahora\s+mismo)\b/, 'Solicitud urgente'),
  rule(CATEGORIES.URGENCY, 20, /\b(?:urgente|inmediatamente|de\s+inmediato|cuanto\s+antes|sin\s+demora|sin\s+falta)\b/, 'Urgencia explícita'),
  rule(CATEGORIES.URGENCY, 15, /^(?:ya|ahora|hoy|urgente|rapido)$/, 'Urgencia breve explícita'),
  rule(CATEGORIES.URGENCY, 20, /\b(?:es\s+para\s+hoy|lo\s+requiero\s+hoy|lo\s+ocupo\s+hoy|es\s+una\s+emergencia)\b/, 'Necesidad inmediata'),

  // ===== RIESGO DE PAGO =====
  rule(CATEGORIES.PAYMENT_RISK, 60, /\b(?:me\s+cobraron\s+dos\s+veces|cobro\s+duplicado|cargo\s+duplicado|doble\s+cobro|me\s+cobraron\s+de\s+más)\b/, 'Cobro duplicado'),
  rule(CATEGORIES.PAYMENT_RISK, 55, /\b(?:no\s+reconozco\s+(?:el|este|ese)\s+cargo|cargo\s+no\s+reconocido|me\s+descontaron\s+dinero|me\s+desaparecio\s+dinero)\b/, 'Cargo o descuento cuestionado'),
  rule(CATEGORIES.PAYMENT_RISK, 40, /\b(?:stripe\s+me\s+cobro|mi\s+tarjeta\s+fue\s+rechazada|pago\s+rechazado|pago\s+declinado|no\s+paso\s+mi\s+pago|error\s+en\s+el\s+pago)\b/, 'Incidencia de pago'),
  rule(CATEGORIES.PAYMENT_RISK, 50, /\b(?:me\s+estan\s+cobrando\s+sin\s+autorizacion|cobro\s+no\s+autorizado|me\s+siguen\s+cobrando)\b/, 'Cobro no autorizado'),
  rule(CATEGORIES.PAYMENT_RISK, 45, /\b(?:me\s+cobraron\s+y\s+no\s+recibi\s+nada|pague\s+y\s+no\s+me\s+entregaron)\b/, 'Pago sin producto/servicio'),
  rule(CATEGORIES.PAYMENT_RISK, 50, /\b(?:me\s+cobr[oó]\s+pero\s+no|pagu[eé]\s+pero\s+no|hice\s+el\s+pago\s+pero\s+no)\s+(?:se\s+registr[oó]|se\s+reflej[oó]|aparece|me\s+aparece|qued[oó]\s+registrad[oa])\b/, 'Pago no registrado'),

  // ===== REEMBOLSOS =====
  rule(CATEGORIES.REFUND, 35, /\b(?:quiero|solicito|necesito|exijo|pido)\s+(?:una\s+)?devolucion\b/, 'Solicitud de devolución'),
  rule(CATEGORIES.REFUND, 35, /\b(?:quiero\s+mi\s+dinero|devuelvanme\s+(?:mi\s+)?dinero|quiero\s+un\s+reembolso|regresen\s+mi\s+dinero|reintegren\s+mi\s+dinero)\b/, 'Solicitud de devolución de dinero'),
  rule(CATEGORIES.REFUND, 25, /\b(?:reembolso|devolucion|devolver\s+el\s+producto|regresar\s+el\s+producto|cancelar\s+y\s+reembolsar)\b/, 'Consulta de devolución o reembolso'),
  rule(CATEGORIES.REFUND, 25, /\bdevuelvanme\b/, 'Solicitud de devolución'),
  rule(CATEGORIES.REFUND, 30, /\b(?:no\s+es\s+lo\s+que\s+esperaba|no\s+me\s+gusto|no\s+era\s+lo\s+que\s+pedi|producto\s+equivocado)\b/, 'Insatisfacción con el producto'),

  // ===== REPORTE DE FRAUDE =====
  rule(CATEGORIES.FRAUD_REPORT, 70, /\b(?:me\s+estafaron|son\s+estafadores|es\s+un\s+fraude|robaron\s+mi\s+dinero|me\s+vaciaron\s+la\s+cuenta)\b/, 'Reporte explícito de fraude'),
  rule(CATEGORIES.FRAUD_REPORT, 55, /\b(?:esto\s+es\s+una\s+estafa|me\s+robaron|empresa\s+fraudulenta|negocio\s+fraudulento|son\s+unos\s+ratas)\b/, 'Acusación de fraude'),
  rule(CATEGORIES.FRAUD_REPORT, 50, /\b(?:me\s+enganaron|me\s+mintieron|me\s+timaron|es\s+un\s+engaño|publicidad\s+enganosa)\b/, 'Acusación de engaño'),
  rule(CATEGORIES.FRAUD_REPORT, 65, /\b(?:suplantacion\s+de\s+identidad|robo\s+de\s+identidad|usaron\s+mis\s+datos|phishing)\b/, 'Suplantación de identidad'),

  // ===== CONTRACARGO =====
  rule(CATEGORIES.CHARGEBACK, 75, /\b(?:voy\s+a\s+desconocer\s+(?:el|este|ese|la)\s+cargo|desconocere\s+(?:el|este|ese|la)\s+cargo|chargeback|contracargo|reversar\s+el\s+cargo)\b/, 'Riesgo de contracargo'),
  rule(CATEGORIES.CHARGEBACK, 45, /\b(?:hablare|voy\s+a\s+hablar|llamare|voy\s+a\s+llamar)\s+con\s+(?:mi\s+)?banco\b/, 'Escalamiento con el banco'),
  rule(CATEGORIES.CHARGEBACK, 50, /\b(?:voy\s+a\s+reportar\s+(?:el|este|ese|la)\s+cargo\s+con\s+(?:mi\s+)?banco|reportare\s+(?:el|este|ese|la)\s+cargo\s+con\s+(?:mi\s+)?banco)\b/, 'Reporte al banco'),
  rule(CATEGORIES.CHARGEBACK, 55, /\b(?:voy\s+a\s+desconocer\s+todos\s+los\s+cargos|desconocere\s+todos\s+los\s+cargos|cancelare\s+mi\s+tarjeta)\b/, 'Desconocimiento masivo'),

  // ===== CUENTA =====
  rule(CATEGORIES.ACCOUNT, 15, /\b(?:no\s+puedo\s+iniciar\s+sesion|no\s+puedo\s+entrar|olvide\s+mi\s+contrasena|no\s+llega\s+(?:el|mi)\s+codigo|no\s+me\s+deja\s+acceder)\b/, 'Problema de acceso a la cuenta'),
  rule(CATEGORIES.ACCOUNT, 10, /\b(?:mi\s+cuenta|iniciar\s+sesion|recuperar\s+(?:mi\s+)?contrasena|restablecer\s+contraseña|crear\s+cuenta)\b/, 'Consulta de cuenta'),
  rule(CATEGORIES.ACCOUNT, 15, /\b(?:me\s+bloquearon\s+la\s+cuenta|cuenta\s+bloqueada|cuenta\s+suspendida|no\s+me\s+deja\s+comprar)\b/, 'Problema de bloqueo de cuenta'),

  // ===== PEDIDOS =====
  rule(CATEGORIES.ORDER, 15, /\b(?:mi\s+pedido|mi\s+orden)\s+(?:no\s+llega|no\s+aparece|esta\s+retrasad[oa]|esta\s+incomplet[oa]|se\s+perdio|lleva\s+retraso)\b/, 'Incidencia con un pedido'),
  rule(CATEGORIES.ORDER, 15, /^(?:no\s+llega|no\s+aparece|se\s+perdio|esta\s+tardando)$/, 'Incidencia con un pedido'),
  rule(CATEGORIES.ORDER, 5, /\b(?:mi\s+pedido|mi\s+orden|numero\s+de\s+pedido|estado\s+del\s+pedido|seguimiento\s+de\s+pedido|rastrear\s+pedido)\b/, 'Consulta de pedido'),
  rule(CATEGORIES.ORDER, 10, /\b(?:cuando\s+llega|fecha\s+de\s+entrega|tiempo\s+de\s+envio|donde\s+esta\s+mi\s+paquete)\b/, 'Consulta de entrega'),
  rule(CATEGORIES.ORDER, 15, /\b(?:mi\s+paquete|el\s+paquete|mi\s+producto|el\s+producto)\s+(?:venia|estaba|llegó|esta|viene)\s+(?:dañado|roto|golpeado|abierto|incompleto|defectuoso|en\s+mal\s+estado)\b/, 'Producto dañado o defectuoso'),
  rule(CATEGORIES.ORDER, 15, /\b(?:destruyeron|rompieron|dañaron|golpearon)\s+(?:mi|el)\s+(?:paquete|producto|pedido)\b/, 'Producto destruido en tránsito'),
  
    
  // ===== NUEVO: INCIDENCIAS DE PRODUCTO/SERVICIO (CORREGIDO - Cobertura para casos reportados) =====
  rule(CATEGORIES.ORDER, 15, /\b(?:mi\s+paquete|el\s+paquete|mi\s+producto|el\s+producto)\s+(?:venia|estaba|llegó|esta|viene)\s+(?:dañado|roto|golpeado|abierto|incompleto|defectuoso|en\s+mal\s+estado)\b/, 'Producto dañado o defectuoso'),
  rule(CATEGORIES.ORDER, 15, /\b(?:destruyeron|rompieron|dañaron|golpearon)\s+(?:mi|el)\s+(?:paquete|producto|pedido)\b/, 'Producto destruido en tránsito'),

  // ===== PAGOS =====
  rule(CATEGORIES.PAYMENT, 5, /\b(?:pago|tarjeta|transferencia|deposito|visa|mastercard|amex|oxxo|paypal|spei)\b/, 'Consulta de pago'),
  rule(CATEGORIES.PAYMENT, 10, /\b(?:metodos?\s+de\s+pago|formas?\s+de\s+pago|aceptan\s+tarjeta|pago\s+en\s+efectivo)\b/, 'Consulta de métodos de pago'),

  // ===== CRIPTO =====
  rule(CATEGORIES.CRYPTO, 10, /\b(?:bitcoin|cripto|criptomoneda|invierte\s+en\s+cripto|ethereum|blockchain|nft|token)\b/, 'Mención de criptomonedas'),

  // ===== PROMOCIONES =====
  rule(CATEGORIES.PROMOTION, 5, /\b(?:oferta|descuento|promo|promocion|cupon|codigo\s+de\s+descuento|rebaja|liquidacion)\b/, 'Consulta promocional'),
  rule(CATEGORIES.PROMOTION, 5, /\b(?:tienen\s+descuento|hay\s+promocion|tienen\s+ofertas|aplican\s+cupones)\b/, 'Pregunta sobre promociones'),
];