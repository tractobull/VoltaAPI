import { getSentiment, getSeverity, getSuggestedQueue, shouldPrioritize, SEVERITY, CATEGORIES } from './types.js';
import { calculateWordScore } from './rules.js';
import { detectCategories, detectSpam, generateFlags } from './rules.js';
import { detectPersonalData, detectUrls, detectIPs, getPersonalDataScore } from './patterns.js';

const MODERATION_CATEGORIES = [
  CATEGORIES.THREAT,
  CATEGORIES.INSULT,
  CATEGORIES.HATE,
  CATEGORIES.HARASSMENT,
  CATEGORIES.SEXUAL,
  CATEGORIES.PERSONAL_DATA,
];

export class ModerationService {
  /**
   * Analiza un mensaje para moderación
   * @param {string} message - El mensaje a analizar
   * @returns {Object} Resultado del análisis de moderación
   */
  static analyze(message) {
    if (!message || typeof message !== 'string') {
      return this._emptyResult();
    }

    const text = message.trim();
    if (text.length === 0) {
      return this._emptyResult();
    }

    // Calcular puntuación basada en palabras
    const { score: contentScore, baseScore, moderationBaseScore, classificationBaseScore, scoreModifiers, detectedWords, detectedPhrases } = calculateWordScore(text);

    // Detectar datos personales
    const personalDataDetected = detectPersonalData(text);
    const personalDataScore = getPersonalDataScore(personalDataDetected);
    const score = Math.max(contentScore, personalDataScore);

    // Detectar URLs e IPs
    const urlsDetected = detectUrls(text);
    const ipsDetected = detectIPs(text);

    // Detectar categorías
    const categories = detectCategories(text, personalDataDetected, urlsDetected);

    // Detectar patrones de spam
    const spamFlags = detectSpam(text);

    // Generar flags
    const flags = generateFlags(categories, score, spamFlags);

    // Determinar severidad
    const severity = getSeverity(score);

    // Determinar si debe ser priorizado
    const priority = shouldPrioritize(categories, severity);
    const sentiment = getSentiment(categories);
    const suggestedQueue = getSuggestedQueue(categories);

    return {
      score,
      severity,
      categories,
      flags,
      priority,
      sentiment,
      suggestedQueue,
      detectedWords,
      detectedPhrases,
      metadata: {
        personalDataDetected,
        personalDataScore,
        contentBaseScore: baseScore,
        moderationBaseScore,
        classificationBaseScore,
        scoreModifiers,
        urlsDetected,
        ipsDetected,
        spamFlags,
        messageLength: text.length,
      },
    };
  }

  /**
   * Analiza múltiples mensajes y agrega resultados
   * @param {string[]} messages - Array de mensajes a analizar
   * @returns {Object} Resultado agregado de la moderación
   */
  static analyzeConversation(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return this._emptyResult();
    }

    const results = messages.map(msg => this.analyze(msg));

    // Agregar puntuaciones
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = totalScore / results.length;
    const maxScore = Math.max(...results.map(r => r.score));

    // Agregar categorías (únicas)
    const allCategories = [...new Set(results.flatMap(r => r.categories))];

    // Agregar flags (únicos)
    const allFlags = [...new Set(results.flatMap(r => r.flags))];

    // Determinar severidad basada en la puntuación máxima
    const severity = getSeverity(maxScore);

    // Determinar prioridad
    const priority = shouldPrioritize(allCategories, severity);

    return {
      score: maxScore,
      avgScore,
      severity,
      categories: allCategories,
      flags: allFlags,
      priority,
      sentiment: getSentiment(allCategories),
      suggestedQueue: getSuggestedQueue(allCategories),
      messageCount: results.length,
      metadata: {
        totalScore,
        messageBreakdown: results,
      },
    };
  }

  /**
   * Verifica si un mensaje debe activar una advertencia antes de enviar
   * @param {string} message - El mensaje a verificar
   * @returns {Object} Resultado de la verificación de advertencia
   */
  static checkWarning(message) {
    const analysis = this.analyze(message);
    
    return {
      shouldWarn: analysis.severity === SEVERITY.MEDIUM || 
                  analysis.severity === SEVERITY.HIGH ||
                  analysis.severity === SEVERITY.CRITICAL,
      analysis,
      warningMessage: this._getWarningMessage(analysis),
    };
  }

  static checkWarningUser(message) {
    const analysis = this.analyze(message);

    const shouldWarn = analysis.categories.some(category =>
      MODERATION_CATEGORIES.includes(category)
    );

    return {
      shouldWarn,
      analysis,
      warningMessage: shouldWarn
        ? this._getWarningMessage(analysis)
        : null,
    };
  }

  /**
   * Obtiene un mensaje de advertencia apropiado basado en el análisis
   * @private
   */
  static _getWarningMessage(analysis) {
    if (analysis.categories.includes(CATEGORIES.THREAT)) {
      return 'Este mensaje contiene una posible amenaza y requiere revisión inmediata.';
    }

    if (analysis.categories.includes(CATEGORIES.PERSONAL_DATA)) {
      return 'Este mensaje contiene información personal sensible.';
    }

    if (analysis.categories.includes(CATEGORIES.LEGAL)) {
      return 'Este mensaje menciona términos legales que podrían requerir atención.';
    }

    if (analysis.severity === SEVERITY.CRITICAL) {
      return 'Este mensaje contiene lenguaje altamente ofensivo o amenazas.';
    }
    
    if (analysis.severity === SEVERITY.HIGH) {
      return 'Este mensaje contiene lenguaje que podría resultar ofensivo.';
    }
    
    if (analysis.severity === SEVERITY.MEDIUM) {
      return 'Este mensaje contiene lenguaje que podría ser inapropiado.';
    }
    
    return null;
  }

  /**
   * Retorna una estructura de resultado vacía
   * @private
   */
  static _emptyResult() {
    return {
      score: 0,
      severity: SEVERITY.LOW,
      categories: [],
      flags: [],
      priority: false,
      sentiment: 'NEUTRAL',
      suggestedQueue: 'GENERAL_SUPPORT',
      metadata: {
        personalDataDetected: [],
        personalDataScore: 0,
        contentBaseScore: 0,
        moderationBaseScore: 0,
        classificationBaseScore: 0,
        scoreModifiers: [],
        urlsDetected: [],
        ipsDetected: [],
        spamFlags: [],
        messageLength: 0,
      },
    };
  }
}
