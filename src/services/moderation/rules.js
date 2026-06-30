import { CATEGORIES } from './types.js';
import { detectPersonalData, detectUrls, detectIPs } from './patterns.js';
import { MODERATION_RULES } from './moderationRules.js';
import { removeSafePatterns } from './safePatterns.js';

const MODERATION_CATEGORIES = new Set([
  CATEGORIES.INSULT,
  CATEGORIES.THREAT,
  CATEGORIES.SEXUAL,
  CATEGORIES.HATE,
  CATEGORIES.HARASSMENT,
]);

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(.)\1{2,}/g, '$1') // squash elongated character repetitions (3+ identical characters)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRuleMatches(text) {
  const normalizedText = removeSafePatterns(normalizeText(text));
  return MODERATION_RULES.filter(({ regex, exclude }) => (
    regex.test(normalizedText) && (!exclude || !exclude.test(normalizedText))
  ));
}

function getScoreModifiers(text, matches) {
  if (!matches.some(({ category }) => MODERATION_CATEGORIES.has(category))) return [];

  const normalizedText = normalizeText(text);
  const modifiers = [];
  const intensifierCount = normalizedText.match(/\b(?:maldit[oa]s?|pinche|put[oa](?=\s+\w))\b/g)?.length || 0;
  if (intensifierCount > 0) {
    modifiers.push({ type: 'intensifiers', multiplier: Math.min(1.2, intensifierCount * 0.6) });
  }

  const maxRepetitions = matches.reduce((highest, { regex }) => {
    const repeatedRegex = new RegExp(regex.source, `${regex.flags.replace('g', '')}g`);
    return Math.max(highest, normalizedText.match(repeatedRegex)?.length || 0);
  }, 0);
  if (maxRepetitions >= 2) {
    modifiers.push({ type: 'repetition', multiplier: maxRepetitions >= 3 ? 0.35 : 0.2 });
  }

  const letters = text.match(/[a-záéíóúüñ]/gi) || [];
  const uppercaseLetters = text.match(/[A-ZÁÉÍÓÚÜÑ]/g) || [];
  if (letters.length >= 6 && uppercaseLetters.length / letters.length >= 0.7) {
    modifiers.push({ type: 'uppercase', multiplier: 0.2 });
  }

  if (/[!?]{4,}/.test(text)) modifiers.push({ type: 'excessive_punctuation', multiplier: 0.15 });
  if (text.length >= 600) modifiers.push({ type: 'long_message', multiplier: 0.25 });

  return modifiers;
}

// Calculate word-based score and return detected words
export function calculateWordScore(text) {
  const matches = getRuleMatches(text);
  const scoreByCategory = matches.reduce((scores, match) => {
    const key = match.category || 'UNCATEGORIZED';
    scores[key] = Math.max(scores[key] || 0, match.weight);
    return scores;
  }, {});
  const moderationBaseScore = Math.max(
    0,
    ...Object.entries(scoreByCategory).map(([category, weight]) => MODERATION_CATEGORIES.has(category) ? weight : 0)
  );
  const classificationBaseScore = Math.max(
    0,
    ...Object.entries(scoreByCategory).map(([category, weight]) => MODERATION_CATEGORIES.has(category) ? 0 : weight)
  );
  const baseScore = Math.max(moderationBaseScore, classificationBaseScore);
  const scoreModifiers = getScoreModifiers(text, matches);
  const totalMultiplier = scoreModifiers.reduce((total, modifier) => total + modifier.multiplier, 1);
  const score = Math.max(Math.round(moderationBaseScore * totalMultiplier), classificationBaseScore);
  const detectedWords = matches
    .filter(({ regex }) => !regex.source.includes('\\s'))
    .map(({ description, weight }) => ({ word: description, weight }));
  const detectedPhrases = matches
    .filter(({ regex }) => regex.source.includes('\\s'))
    .map(({ description, weight }) => ({ word: description, weight }));

  return { score, baseScore, moderationBaseScore, classificationBaseScore, scoreModifiers, detectedWords, detectedPhrases };
}

// Detect categories based on content
export function detectCategories(text, personalDataDetected, urlsDetected) {
  const categories = [...new Set(
    getRuleMatches(text)
      .map(({ category }) => category)
      .filter(Boolean)
  )];
  
  // Add personal data category if detected
  if (personalDataDetected.length > 0) {
    categories.push(CATEGORIES.PERSONAL_DATA);
  }
  
  // Add spam category if multiple URLs detected
  if (urlsDetected.length >= 2) {
    categories.push(CATEGORIES.SPAM);
  }

  if (urlsDetected.length >= 1) {
    categories.push(CATEGORIES.LINK);
  }
  
  return categories;
}

// Detect spam patterns
export function detectSpam(text) {
  const flags = [];
  const normalizedText = text.toLowerCase();
  
  // Excessive repetition (same word repeated 3+ times)
  const words = normalizedText.split(/\s+/);
  const wordCount = {};
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  for (const [word, count] of Object.entries(wordCount)) {
    if (count >= 3 && word.length > 2) {
      flags.push('excessive_repetition');
      break;
    }
  }
  
  // Repeated characters (aaaaa, bbbbb, etc.)
  if (/(.)\1{4,}/.test(normalizedText)) {
    flags.push('repeated_characters');
  }
  
  // Extremely long message without spaces
  if (text.length > 200 && !/\s/.test(text.substring(0, 100))) {
    flags.push('long_no_spaces');
  }
  
  // Multiple URLs
  const urls = detectUrls(text);
  if (urls.length >= 2) {
    flags.push('multiple_urls');
  }
  
  // Multiple IPs
  const ips = detectIPs(text);
  if (ips.length >= 1) {
    flags.push('ip_address');
  }
  
  return flags;
}

// Generate flags based on analysis
export function generateFlags(categories, score, spamFlags) {
  const flags = [];
  
  if (categories.includes(CATEGORIES.THREAT)) {
    flags.push('threat_detected');
  }
  
  if (categories.includes(CATEGORIES.LEGAL)) {
    flags.push('legal_risk');
  }
  
  if (categories.includes(CATEGORIES.PERSONAL_DATA)) {
    flags.push('personal_data_exposed');
  }
  
  if (categories.includes(CATEGORIES.SEXUAL)) {
    flags.push('sexual_content');
  }
  
  if (categories.includes(CATEGORIES.HATE)) {
    flags.push('hate_speech');
  }
  
  if (categories.includes(CATEGORIES.HARASSMENT)) {
    flags.push('harassment');
  }

  if (categories.includes(CATEGORIES.CUSTOMER_RISK)) flags.push('customer_at_risk');
  if (categories.includes(CATEGORIES.URGENCY)) flags.push('urgent_request');
  if (categories.includes(CATEGORIES.PAYMENT_RISK)) flags.push('payment_risk');
  if (categories.includes(CATEGORIES.FRAUD_REPORT)) flags.push('fraud_report');
  if (categories.includes(CATEGORIES.CHARGEBACK)) flags.push('chargeback_risk');
  
  if (spamFlags.length > 0) {
    flags.push(...spamFlags);
  }
  
  if (score >= 80) {
    flags.push('critical_severity');
  }
  
  return flags;
}
