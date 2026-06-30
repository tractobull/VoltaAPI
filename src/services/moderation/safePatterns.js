// Se eliminan antes de evaluar reglas. El resto del mensaje sigue analizándose,
// por lo que "me toca, idiota" conserva la detección del insulto.
export const SAFE_PATTERNS = [
  /\b(?:me|te|le|nos|les)\s+toca\b/g,
  /\btoca\s+(?:revisar|confirmar|validar|esperar|hacer|el\s+turno)\b/g,
  /\btocar\s+(?:base|el\s+tema|la\s+puerta)\b/g,
  /\bseguir\s+(?:revisando|validando|esperando|el\s+proceso|el\s+pedido)\b/g,
  /\b(?:color|pieza|caja|camisa|pintura|tono|gato)\s+(?:negro|negra)\b/g,
  /\b(?:mercado|humor|dinero|lista|caja)\s+negro\b/g,
  /\b(?:producto|servicio)\s+gratis\b/g,
];

export function removeSafePatterns(text) {
  return SAFE_PATTERNS.reduce((safeText, pattern) => safeText.replace(pattern, ' '), text);
}
