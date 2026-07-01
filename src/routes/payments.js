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

export function createCustomerRecreationGuard() {
  const pendingCreations = new Map();

  return {
    async run(userId, operation) {
      const existing = pendingCreations.get(userId);
      if (existing) {
        return existing;
      }

      const task = (async () => {
        try {
          return await operation();
        } finally {
          pendingCreations.delete(userId);
        }
      })();

      pendingCreations.set(userId, task);
      return task;
    },
  };
}

export function isMissingCustomerError(error) {
  return (
    (error?.code === 'resource_missing' && error?.param === 'customer') ||
    (error?.type === 'StripeInvalidRequestError' && error?.code === 'resource_missing')
  );
}

async function createStripeCustomerForUser(userId, email, name) {
  const customer = await withRetry(() =>
    stripe.customers.create({
      email,
      name,
      metadata: { userId },
    })
  );
  await pool.query(
    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, userId]
  );
  return customer;
}

const customerRecreationGuard = createCustomerRecreationGuard();

async function ensureValidCustomer(customerId, userId, forceRecreate = false) {
  if (!forceRecreate) {
    try {
      await stripe.customers.retrieve(customerId);
      console.log('[ensureValidCustomer] Customer valid:', customerId);
      return customerId;
    } catch (error) {
      console.log('[ensureValidCustomer] Error retrieving customer:', error.code, error.param);
      if (isMissingCustomerError(error)) {
        console.log('[ensureValidCustomer] Recreating customer for user:', userId);
      } else {
        console.error('[ensureValidCustomer] Unexpected error:', error);
        throw error;
      }
    }
  }

  return customerRecreationGuard.run(userId, async () => {
    const userResult = await pool.query(
      'SELECT stripe_customer_id, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error('[ensureValidCustomer] User not found:', userId);
      throw new Error('User not found');
    }

    const { stripe_customer_id: dbCustomerId, email, name } = userResult.rows[0];

    if (dbCustomerId && dbCustomerId !== customerId) {
      try {
        await stripe.customers.retrieve(dbCustomerId);
        console.log('[ensureValidCustomer] Reusing customer from DB after concurrent update:', dbCustomerId);
        return dbCustomerId;
      } catch (error) {
        if (!isMissingCustomerError(error)) {
          throw error;
        }
      }
    }

    console.log('[ensureValidCustomer] Creating new customer for:', email);
    const newCustomer = await createStripeCustomerForUser(userId, email, name);
    console.log('[ensureValidCustomer] New customer created:', newCustomer.id);
    return newCustomer.id;
  });
}

const router = Router();

// Initialize Stripe with test key (sandbox mode)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// POST /api/payments/customer - Create or get Stripe customer for user
router.post('/customer', authenticate, async (req, res) => {
  try {
    const { userId, email, name, skipValidation } = req.body;

    // Check if user already has a Stripe customer ID
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].stripe_customer_id) {
      const existingCustomerId = userResult.rows[0].stripe_customer_id;

      // If skipValidation is true, return the DB value without checking Stripe
      if (skipValidation) {
        console.log('[/customer] Skipping validation, returning DB value:', existingCustomerId);
        return res.json({ customerId: existingCustomerId });
      }

      // Validate the existing customer ID
      try {
        await withRetry(() => stripe.customers.retrieve(existingCustomerId));
        return res.json({ customerId: existingCustomerId });
      } catch (error) {
        if (error?.code === 'resource_missing' && error?.param === 'customer') {
          console.log('[/customer] Existing customer is invalid, recreating:', existingCustomerId);
          // Customer is invalid, will create new one below
        } else {
          throw error;
        }
      }
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

    const validCustomerId = await ensureValidCustomer(customerId, req.user.id);

    const setupIntent = await withRetry(() =>
      stripe.setupIntents.create({
        customer: validCustomerId,
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

// GET /api/payments/methods - List saved payment methods
router.get('/methods', authenticate, async (req, res) => {
  try {
    // Get customer ID from database using userId from token
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      return res.json([]);
    }

    const customerId = userResult.rows[0].stripe_customer_id;

    let finalCustomerId = await ensureValidCustomer(customerId, req.user.id);

    let paymentMethods;
    try {
      paymentMethods = await withRetry(() =>
        stripe.paymentMethods.list({
          customer: finalCustomerId,
          type: 'card',
        })
      );
    } catch (error) {
      // If paymentMethods.list fails with resource_missing, force recreate customer
      if (error?.code === 'resource_missing' && error?.param === 'customer') {
        console.log('[/methods] paymentMethods.list failed, force recreating customer');
        finalCustomerId = await ensureValidCustomer(customerId, req.user.id, true);
        paymentMethods = await withRetry(() =>
          stripe.paymentMethods.list({
            customer: finalCustomerId,
            type: 'card',
          })
        );
      } else {
        throw error;
      }
    }

    // Get the default payment method for this customer
    const customer = await stripe.customers.retrieve(finalCustomerId);
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

    const validCustomerId = await ensureValidCustomer(customerId, req.user.id);

    await withRetry(() =>
      stripe.customers.update(validCustomerId, {
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

    const validCustomerId = await ensureValidCustomer(customerId, req.user.id);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency || 'mxn',
      customer: validCustomerId,
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
