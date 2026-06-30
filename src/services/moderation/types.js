// Severity levels
export const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

// Severity thresholds
export const SEVERITY_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 20,
  HIGH: 50,
  CRITICAL: 80,
};

// Moderation categories
export const CATEGORIES = {
  INSULT: 'INSULT',
  THREAT: 'THREAT',
  LEGAL: 'LEGAL',
  SPAM: 'SPAM',
  PERSONAL_DATA: 'PERSONAL_DATA',
  SEXUAL: 'SEXUAL',
  HATE: 'HATE',
  HARASSMENT: 'HARASSMENT',
  CUSTOMER_RISK: 'CUSTOMER_RISK',
  URGENCY: 'URGENCY',
  PAYMENT_RISK: 'PAYMENT_RISK',
  REFUND: 'REFUND',
  FRAUD_REPORT: 'FRAUD_REPORT',
  CHARGEBACK: 'CHARGEBACK',
  ACCOUNT: 'ACCOUNT',
  ORDER: 'ORDER',
  PAYMENT: 'PAYMENT',
  PROMOTION: 'PROMOTION',
  CRYPTO: 'CRYPTO',
  LINK: 'LINK',
};

// Priority triggers
export const PRIORITY_TRIGGERS = {
  LEGAL_RISK: [CATEGORIES.LEGAL],
  THREAT_RISK: [CATEGORIES.THREAT],
  OPERATIONAL_RISK: [
    CATEGORIES.CUSTOMER_RISK,
    CATEGORIES.URGENCY,
    CATEGORIES.PAYMENT_RISK,
    CATEGORIES.FRAUD_REPORT,
    CATEGORIES.CHARGEBACK,
  ],
  SEVERITY: [SEVERITY.HIGH, SEVERITY.CRITICAL],
};

// Get severity from score
export function getSeverity(score) {
  if (score >= SEVERITY_THRESHOLDS.CRITICAL) return SEVERITY.CRITICAL;
  if (score >= SEVERITY_THRESHOLDS.HIGH) return SEVERITY.HIGH;
  if (score >= SEVERITY_THRESHOLDS.MEDIUM) return SEVERITY.MEDIUM;
  return SEVERITY.LOW;
}

// Check if conversation should be prioritized
export function shouldPrioritize(categories, severity) {
  if (PRIORITY_TRIGGERS.LEGAL_RISK.some(cat => categories.includes(cat))) return true;
  if (PRIORITY_TRIGGERS.THREAT_RISK.some(cat => categories.includes(cat))) return true;
  if (PRIORITY_TRIGGERS.OPERATIONAL_RISK.some(cat => categories.includes(cat))) return true;
  if (PRIORITY_TRIGGERS.SEVERITY.includes(severity)) return true;
  return false;
}

const NEGATIVE_CATEGORIES = new Set([
  CATEGORIES.INSULT,
  CATEGORIES.THREAT,
  CATEGORIES.HATE,
  CATEGORIES.HARASSMENT,
  CATEGORIES.CUSTOMER_RISK,
  CATEGORIES.PAYMENT_RISK,
  CATEGORIES.REFUND,
  CATEGORIES.FRAUD_REPORT,
  CATEGORIES.CHARGEBACK,
]);

export function getSentiment(categories) {
  return categories.some((category) => NEGATIVE_CATEGORIES.has(category)) ? 'NEGATIVE' : 'NEUTRAL';
}

export function getSuggestedQueue(categories) {
  if (categories.some((category) => [CATEGORIES.THREAT, CATEGORIES.LEGAL, CATEGORIES.HATE].includes(category))) return 'ESCALATION';
  if (categories.some((category) => [CATEGORIES.PAYMENT_RISK, CATEGORIES.FRAUD_REPORT, CATEGORIES.CHARGEBACK, CATEGORIES.PAYMENT].includes(category))) return 'PAYMENTS';
  if (categories.some((category) => [CATEGORIES.ORDER, CATEGORIES.REFUND].includes(category))) return 'POST_SALES';
  if (categories.includes(CATEGORIES.ACCOUNT)) return 'ACCOUNT_SUPPORT';
  return 'GENERAL_SUPPORT';
}
