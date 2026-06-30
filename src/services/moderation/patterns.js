// Patrones de detección de datos personales y sensibles

// Patrones de tarjetas de crédito (Visa, Mastercard, Amex, Discover)
export const CREDIT_CARD_PATTERNS = [
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
];

// Patrones de CVV/CVC (3-4 dígitos)
export const CVV_PATTERNS = [
  /\b(?:cvv|cvc|codigo\s+de\s+seguridad)\s*(?:(?:es|son)\s*)?[:#-]?\s*\d{3,4}\b/gi,
];

// Patrones de RFC (Identificación fiscal mexicana)
export const RFC_PATTERNS = [
  /(?<![A-Z0-9&Ñ])[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}(?![A-Z0-9&Ñ])/i,
];

// Patrones de CURP (Identificación mexicana)
export const CURP_PATTERNS = [
  /\b[A-Z]{4}\d{6}[A-Z]{6}[A-Z0-9]{2}\b/i,
];

// Patrones de correo electrónico
export const EMAIL_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

// Patrones de teléfono (Formato mexicano)
export const PHONE_PATTERNS = [
  /\b\d{10}\b/g, // 10 digits
  /\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b/g, // 555-555-5555
  /\b\+52\s?\d{3}\s?\d{3}\s?\d{4}\b/g, // +52 555 555 5555
  /\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/g, // (555) 555-5555
];

// Patrones de contraseñas
export const PASSWORD_PATTERNS = [
  /\bcontraseña[:\s]\S+/gi,
  /\bpassword[:\s]\S+/gi,
  /\bpass[:\s]\S+/gi,
  /\bclave[:\s]\S+/gi,
  /\bsecret[:\s]\S+/gi,
];

// Patrones de URLs (para detección de spam)
export const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /\b[a-z0-9-]+\.(com|mx|net|org|info|biz)\b/gi,
];

// Patrones de direcciones IP
export const IP_PATTERNS = [
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

// Patrones de seguridad social
export const SSN_PATTERNS = [
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
];

// Patrones de cuentas bancarias (general)
export const BANK_ACCOUNT_PATTERNS = [
  /\bcuenta[:\s]\d{10,20}\b/gi,
  /\bclabe[:\s]\d{18}\b/gi,
  /\baccount[:\s]\d{10,20}\b/gi,
];

export const PERSONAL_DATA_WEIGHTS = {
  credit_card: 70,
  cvv: 70,
  password: 80,
  bank_account: 70,
  curp: 60,
  ssn: 60,
  rfc: 50,
  phone: 20,
  email: 10,
};

export function getPersonalDataScore(detectedTypes) {
  return detectedTypes.reduce(
    (highest, type) => Math.max(highest, PERSONAL_DATA_WEIGHTS[type] || 0),
    0
  );
}

function matchesAny(patterns, text) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

// Función para detectar datos personales en el texto
export function detectPersonalData(text) {
  const detected = [];
  
  if (matchesAny(CREDIT_CARD_PATTERNS, text)) {
    detected.push('credit_card');
  }
  
  if (matchesAny(CVV_PATTERNS, text)) {
    detected.push('cvv');
  }
  
  if (matchesAny(RFC_PATTERNS, text)) {
    detected.push('rfc');
  }
  
  if (matchesAny(CURP_PATTERNS, text)) {
    detected.push('curp');
  }
  
  if (matchesAny(EMAIL_PATTERNS, text)) {
    detected.push('email');
  }
  
  if (matchesAny(PHONE_PATTERNS, text)) {
    detected.push('phone');
  }
  
  if (matchesAny(PASSWORD_PATTERNS, text)) {
    detected.push('password');
  }
  
  if (matchesAny(BANK_ACCOUNT_PATTERNS, text)) {
    detected.push('bank_account');
  }
  
  if (matchesAny(SSN_PATTERNS, text)) {
    detected.push('ssn');
  }
  
  return detected;
}

// Función para detectar URLs (para detección de spam)
export function detectUrls(text) {
  const matches = [];
  URL_PATTERNS.forEach(pattern => {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  });
  return matches;
}

// Función para detectar direcciones IP
export function detectIPs(text) {
  const matches = [];
  IP_PATTERNS.forEach(pattern => {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  });
  return matches;
}
