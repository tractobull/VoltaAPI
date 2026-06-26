import { Router } from 'express';
import Stripe from 'stripe';
import pool from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error?.type === 'StripeRateLimitError' && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

const router = Router();

// Initialize Stripe with test key (sandbox mode)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// POST /api/payments/customer - Create or get Stripe customer for user
router.post('/customer', authenticate, async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    // Check if user already has a Stripe customer ID
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].stripe_customer_id) {
      return res.json({ customerId: userResult.rows[0].stripe_customer_id });
    }

    // Create new Stripe customer
    const customer = await withRetry(() =>
      stripe.customers.create({
        email,
        name,
        metadata: { userId },
      })
    );

    // Save customer ID to user record
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, userId]
    );

    res.json({ customerId: customer.id });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    if (error?.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Error creating customer' });
  }
});

// POST /api/payments/setup-intent - Create SetupIntent to save a card
router.post('/setup-intent', authenticate, async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    const setupIntent = await withRetry(() =>
      stripe.setupIntents.create({
        customer: customerId,
      })
    );

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    if (error?.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Error creating setup intent' });
  }
});

// GET /api/payments/methods/:customerId - List saved payment methods
router.get('/methods/:customerId', authenticate, async (req, res) => {
  try {
    const customerId = req.params.customerId;

    const paymentMethods = await withRetry(() =>
      stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })
    );

    // Get the default payment method for this customer
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    const methods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    res.json(methods);
  } catch (error) {
    console.error('Error listing payment methods:', error);
    if (error?.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Error listing payment methods' });
  }
});

// POST /api/payments/set-default - Set default payment method
router.post('/set-default', authenticate, async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;

    await withRetry(() =>
      stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    if (error?.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    res.status(500).json({ error: 'Error setting default payment method' });
  }
});

// DELETE /api/payments/methods/:paymentMethodId - Detach (delete) a payment method
router.delete('/methods/:paymentMethodId', authenticate, async (req, res) => {
  try {
    const paymentMethodId = req.params.paymentMethodId;

    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Error deleting payment method' });
  }
});

// POST /api/payments/charge - Charge a saved payment method
router.post('/charge', authenticate, async (req, res) => {
  try {
    const { customerId, paymentMethodId, amount, currency, orderId } = req.body;

    if (!customerId || !paymentMethodId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency || 'mxn',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: { orderId },
    });

    res.json({
      success: paymentIntent.status === 'succeeded',
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Error charging payment method:', error);
    res.status(500).json({
      error: error.message || 'Error processing payment',
    });
  }
});

export default router;
