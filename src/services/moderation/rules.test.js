import test from 'node:test';
import assert from 'node:assert/strict';
import { ModerationService } from './ModerationService.js';
import { CATEGORIES } from './types.js';

const analyze = (message) => ModerationService.analyze(message);

test('does not moderate ordinary uses of ambiguous words', () => {
  const messages = [
    'Me toca revisar tu pedido',
    'Te toca confirmar la dirección',
    'Vamos a tocar el tema del reembolso',
    'Debo seguir revisando el caso',
    'La pieza es de color negro',
    'El paquete está muy sucio',
  ];
  const moderationCategories = [
    CATEGORIES.INSULT,
    CATEGORIES.THREAT,
    CATEGORIES.SEXUAL,
    CATEGORIES.HATE,
    CATEGORIES.HARASSMENT,
  ];

  for (const message of messages) {
    const categories = analyze(message).categories;
    assert.equal(categories.some((category) => moderationCategories.includes(category)), false, message);
  }
});

test('does not match terms embedded inside other words or fuzzy typos', () => {
  assert.equal(analyze('profecor').categories.includes(CATEGORIES.LEGAL), false);
  assert.equal(analyze('abogadosa').categories.includes(CATEGORIES.LEGAL), false);
  assert.equal(analyze('pedijo').categories.includes(CATEGORIES.INSULT), false);
  assert.equal(analyze('demnada').categories.includes(CATEGORIES.LEGAL), false);
});

test('detects explicit high-confidence patterns', () => {
  assert.ok(analyze('Te voy a matar').categories.includes(CATEGORIES.THREAT));
  assert.ok(analyze('Presentaré una demanda ante PROFECO').categories.includes(CATEGORIES.LEGAL));
  assert.ok(analyze('Quiero tocarte').categories.includes(CATEGORIES.SEXUAL));
  assert.ok(analyze('Tócame').categories.includes(CATEGORIES.SEXUAL));
  assert.ok(analyze('Eres un idiota').categories.includes(CATEGORIES.INSULT));
  assert.ok(analyze('Te voy a seguir').categories.includes(CATEGORIES.HARASSMENT));
});

test('detects Mexican Spanish insults and discriminatory attacks', () => {
  const cases = [
    ['Apúrale naco', CATEGORIES.HATE],
    ['Eres un pinche prieto', CATEGORIES.HATE],
    ['Regrésate a tu país', CATEGORIES.HATE],
    ['Pinche baboso, aprende a leer', CATEGORIES.INSULT],
    ['No sirves para nada', CATEGORIES.INSULT],
    ['Chinga tu madre', CATEGORIES.INSULT],
  ];

  for (const [message, category] of cases) {
    assert.ok(analyze(message).categories.includes(category), message);
  }

  const discriminatoryMessage = analyze('Apúrale naco');
  assert.equal(discriminatoryMessage.severity, 'HIGH');
  assert.equal(discriminatoryMessage.priority, true);
});

test('detects colloquial threats, harassment and sexual harassment', () => {
  const cases = [
    ['Te parto la madre', CATEGORIES.THREAT],
    ['Afuera te espero', CATEGORIES.THREAT],
    ['Te voy a desaparecer', CATEGORIES.THREAT],
    ['No te voy a dejar en paz', CATEGORIES.HARASSMENT],
    ['Sé dónde trabajas', CATEGORIES.HARASSMENT],
    ['Mándame fotos íntimas', CATEGORIES.SEXUAL],
    ['Quiero verte desnuda', CATEGORIES.SEXUAL],
  ];

  for (const [message, category] of cases) {
    assert.ok(analyze(message).categories.includes(category), message);
  }
});

test('keeps nearby operational phrases unclassified', () => {
  const messages = [
    'Apúrale al envío por favor',
    'La pieza negra está en la bodega',
    'Voy a ir a tu oficina para entregar el paquete',
    'Te voy a llamar cuando llegue el pedido',
    'Necesito fotos del producto dañado',
    'El cliente no reconoce el color prieto del catálogo',
  ];

  for (const message of messages) {
    assert.deepEqual(analyze(message).categories, [], message);
  }
});

test('detects RFC values consistently as personal data', () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = analyze('abcd020821661 ese es mi rfc');
    assert.ok(result.categories.includes(CATEGORIES.PERSONAL_DATA));
    assert.ok(result.metadata.personalDataDetected.includes('rfc'));
  }

  const uppercase = analyze('Mi RFC es ABCD020821661');
  assert.ok(uppercase.metadata.personalDataDetected.includes('rfc'));

  const legalEntity = analyze('RFC de empresa: ABC020821661');
  assert.ok(legalEntity.metadata.personalDataDetected.includes('rfc'));
});

test('scores sensitive personal data by risk and requires CVV context', () => {
  const card = analyze('4242424242424242');
  assert.ok(card.categories.includes(CATEGORIES.PERSONAL_DATA));
  assert.equal(card.severity, 'HIGH');
  assert.equal(card.priority, true);

  const rfc = analyze('Gamc040725661');
  assert.ok(rfc.metadata.personalDataDetected.includes('rfc'));
  assert.equal(rfc.severity, 'HIGH');

  assert.deepEqual(analyze('354').categories, []);
  assert.ok(analyze('Mi CVV es 354').metadata.personalDataDetected.includes('cvv'));
});

test('detects colloquial variants observed in support conversations', () => {
  const cases = [
    ['Estafadores', CATEGORIES.LEGAL],
    ['Hdtpm', CATEGORIES.INSULT],
    ['Putito', CATEGORIES.INSULT],
    ['Naquito', CATEGORIES.HATE],
    ['Pinche soporte chafa', CATEGORIES.INSULT],
    ['No la arman para esto', CATEGORIES.INSULT],
  ];

  for (const [message, category] of cases) {
    assert.ok(analyze(message).categories.includes(category), message);
  }
});

test('does not moderate neutral samples from the support trial', () => {
  const messages = [
    'Me vas a ayudar si o no?',
    'Jsjsjaja',
    'VjfjdJjby57263+',
    'Usas bitcoi',
  ];

  for (const message of messages) {
    assert.deepEqual(analyze(message).categories, [], message);
  }
});

test('classifies operational support intents and routes them', () => {
  const cases = [
    ['Estoy harto, es la tercera vez', CATEGORIES.CUSTOMER_RISK, 'GENERAL_SUPPORT'],
    ['Es urgente, lo necesito hoy', CATEGORIES.URGENCY, 'GENERAL_SUPPORT'],
    ['Me cobraron dos veces', CATEGORIES.PAYMENT_RISK, 'PAYMENTS'],
    ['Quiero un reembolso', CATEGORIES.REFUND, 'POST_SALES'],
    ['Son estafadores, me robaron', CATEGORIES.FRAUD_REPORT, 'ESCALATION'],
    ['Voy a desconocer el cargo', CATEGORIES.CHARGEBACK, 'PAYMENTS'],
    ['No puedo iniciar sesión', CATEGORIES.ACCOUNT, 'ACCOUNT_SUPPORT'],
    ['Mi pedido no llega', CATEGORIES.ORDER, 'POST_SALES'],
    ['Tengo un cupón de descuento', CATEGORIES.PROMOTION, 'GENERAL_SUPPORT'],
    ['Bitcoin', CATEGORIES.CRYPTO, 'GENERAL_SUPPORT'],
  ];

  for (const [message, category, queue] of cases) {
    const result = analyze(message);
    assert.ok(result.categories.includes(category), message);
    assert.equal(result.suggestedQueue, queue, message);
  }
});

test('prioritizes operational risk without treating it as abuse', () => {
  const result = analyze('Estoy harto, nadie responde y es urgente');
  assert.ok(result.categories.includes(CATEGORIES.CUSTOMER_RISK));
  assert.ok(result.categories.includes(CATEGORIES.URGENCY));
  assert.equal(result.sentiment, 'NEGATIVE');
  assert.equal(result.priority, true);
  assert.equal(result.categories.includes(CATEGORIES.INSULT), false);
});

test('applies intensity modifiers only to moderation signals', () => {
  const plain = analyze('idiota');
  const intensified = analyze('pinche idiota');
  const repeated = analyze('idiota idiota idiota');
  const uppercase = analyze('ERES UN IDIOTA');
  const punctuated = analyze('eres un idiota!!!!!!!!');
  const orderUppercase = analyze('MI PEDIDO');

  assert.ok(intensified.score > plain.score);
  assert.ok(repeated.score > plain.score);
  assert.ok(uppercase.score > plain.score);
  assert.ok(punctuated.score > plain.score);
  assert.equal(orderUppercase.score, analyze('mi pedido').score);
  assert.ok(intensified.metadata.scoreModifiers.some(({ type }) => type === 'intensifiers'));
});

test('safe patterns remove only the safe fragment', () => {
  assert.deepEqual(analyze('Me toca revisar tu pedido').categories, []);
  assert.ok(analyze('Me toca revisar, idiota').categories.includes(CATEGORIES.INSULT));
  assert.equal(analyze('La pieza negra llegó').categories.includes(CATEGORIES.HATE), false);
});

test('squashes elongated characters (3+ repetitions)', () => {
  const result = analyze('Nacoooooo');
  assert.ok(result.categories.includes(CATEGORIES.HATE));
  assert.equal(result.severity, 'HIGH');
  
  const result2 = analyze('peeeendejooooo');
  assert.ok(result2.categories.includes(CATEGORIES.INSULT));
  assert.equal(result2.severity, 'MEDIUM');
});
