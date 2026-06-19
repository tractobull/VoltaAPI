import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../db/pool';

const router = Router();

// Initialize Stripe with test key (sandbox mode)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

// POST /api/payments/customer - Create or get Stripe customer for user
router.post('/customer', async (req: Request, res: Response) => {
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
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });

    // Save customer ID to user record
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, userId]
    );

    res.json({ customerId: customer.id });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    res.status(500).json({ error: 'Error creating customer' });
  }
});

// POST /api/payments/setup-intent - Create SetupIntent to save a card
router.post('/setup-intent', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    res.status(500).json({ error: 'Error creating setup intent' });
  }
});

// GET /api/payments/methods/:customerId - List saved payment methods
router.get('/methods/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Get the default payment method for this customer
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method;

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
    res.status(500).json({ error: 'Error listing payment methods' });
  }
});

// POST /api/payments/set-default - Set default payment method
router.post('/set-default', async (req: Request, res: Response) => {
  try {
    const { customerId, paymentMethodId } = req.body;

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Error setting default payment method' });
  }
});

// DELETE /api/payments/methods/:paymentMethodId - Detach (delete) a payment method
router.delete('/methods/:paymentMethodId', async (req: Request, res: Response) => {
  try {
    const paymentMethodId = req.params.paymentMethodId as string;

    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Error deleting payment method' });
  }
});

// POST /api/payments/charge - Charge a saved payment method
router.post('/charge', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Error charging payment method:', error);
    res.status(500).json({
      error: error.message || 'Error processing payment',
    });
  }
});

export default router;