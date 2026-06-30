import { COMPANY_INFO } from '../knowledge/company.js';
import { PAYMENTS_INFO } from '../knowledge/payments.js';
import { SHIPPING_INFO } from '../knowledge/shipping.js';
import { REWARDS_INFO } from '../knowledge/rewards.js';
import { CATEGORIES_INFO } from '../knowledge/categories.js';
import { SUPPORT_INFO } from '../knowledge/support.js';
import { IntentDetector } from './IntentDetector.js';
import pool from '../db/pool.js';

const KNOWLEDGE_MAP = {
  payments: PAYMENTS_INFO,
  shipping: SHIPPING_INFO,
  rewards: REWARDS_INFO,
  catalog: CATEGORIES_INFO,
  support: SUPPORT_INFO,
  diagnostics: CATEGORIES_INFO,
  orders: null,
  account: null,
  general: COMPANY_INFO,
  products: CATEGORIES_INFO,
};

export class ContextBuilder {
  static detectIntent(message) {
    return IntentDetector.detect(message);
  }

  static getKnowledgeForIntent(intent) {
    const modules = [COMPANY_INFO];
    const extra = KNOWLEDGE_MAP[intent];
    if (extra) modules.push(extra);
    if (intent === 'general') modules.push(SUPPORT_INFO, CATEGORIES_INFO);
    return modules.join('\n');
  }

  static async getUserContext(userId, intent) {
    if (!userId) return null;
    if (intent === 'products' || intent === 'catalog' || intent === 'general') return null;

    const needed = {
      points: intent === 'rewards' || intent === 'account',
      orders: intent === 'orders' || intent === 'account',
      vehicles: intent === 'diagnostics' || intent === 'account',
      name: intent === 'orders' || intent === 'account' || intent === 'support',
    };

    const hasAny = Object.values(needed).some(v => v);
    if (!hasAny) return null;

    try {
      const fields = ['id'];
      if (needed.name) fields.push('name');
      if (needed.points) fields.push('points');
      const userResult = await pool.query(
        `SELECT ${fields.join(', ')} FROM users WHERE id = $1`,
        [userId]
      );
      if (userResult.rows.length === 0) return null;
      const user = userResult.rows[0];

      const context = {};

      if (needed.name) context.name = user.name || 'Cliente';
      if (needed.points) context.points = user.points || 0;

      if (needed.orders) {
        const ordersResult = await pool.query(
          `SELECT id, status, total, address_id, created_at
           FROM orders WHERE user_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [userId]
        );
        const statusTranslations = {
          PENDING: 'pendiente',
          CONFIRMED: 'confirmado',
          SHIPPED: 'en camino',
          DELIVERED: 'entregado',
          CANCELLED: 'cancelado',
        };
        context.orders = ordersResult.rows.map(o => ({
          id: o.id?.slice(0, 8),
          uuid: o.id,
          status: statusTranslations[o.status] || o.status,
          statusRaw: o.status,
          type: o.address_id ? 'delivery' : 'pickup',
          total: Number(o.total),
          date: o.created_at?.toISOString?.()?.split('T')[0],
        }));
      }

      if (needed.vehicles) {
        const vehiclesResult = await pool.query(
          'SELECT brand, model, year, engine FROM vehicles WHERE user_id = $1',
          [userId]
        );
        context.vehicles = vehiclesResult.rows.map(v =>
          `${v.brand} ${v.model} ${v.year}${v.engine ? ' (' + v.engine + ')' : ''}`
        );
      }

      return context;
    } catch (err) {
      console.error('Error fetching user context:', err);
      return null;
    }
  }

  static formatUserContext(context, intent) {
    if (!context) return '';
    const parts = [];
    if (context.name) parts.push(`Nombre: ${context.name}`);
    if (context.points !== undefined) parts.push(`Puntos: ${context.points} ($${context.points}.00 MXN)`);
    if (context.vehicles?.length) parts.push(`Vehículos: ${context.vehicles.join(', ')}`);
    if (context.orders?.length) {
      const ordersStr = context.orders.map(o => {
        const typeLabel = o.type === 'pickup' ? 'Recoger en tienda' : 'Envío a domicilio';
        return `- [orden:${o.uuid}] #${o.id} | ${o.status} | $${o.total} | ${o.date} | ${typeLabel}`;
      }).join('\n');
      parts.push(`Pedidos:\n${ordersStr}`);
    }
    if (parts.length === 0) return '';
    return `\nCLIENTE\n${parts.join('\n')}\n\nUsa estos datos únicamente cuando el cliente pregunte por su cuenta, pedidos, vehículos o puntos.`;
  }
}
