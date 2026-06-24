import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'name', oi.snapshot->>'name',
        'quantity', oi.quantity,
        'price', oi.price,
        'originalPrice', (oi.snapshot->>'originalPrice')::numeric,
        'discountPercent', (oi.snapshot->>'discountPercent')::numeric
      )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Error fetching orders' });
  }
});

// GET /api/orders/:id - Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'name', oi.snapshot->>'name',
        'quantity', oi.quantity,
        'price', oi.price,
        'originalPrice', (oi.snapshot->>'originalPrice')::numeric,
        'discountPercent', (oi.snapshot->>'discountPercent')::numeric
      )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Error fetching order' });
  }
});

// GET /api/orders/user/:userId - Get orders by user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'name', oi.snapshot->>'name',
        'quantity', oi.quantity,
        'price', oi.price,
        'originalPrice', (oi.snapshot->>'originalPrice')::numeric,
        'discountPercent', (oi.snapshot->>'discountPercent')::numeric
      )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ error: 'Error fetching user orders' });
  }
});

// POST /api/orders - Create order
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId, addressId, items, notes, trackingData } = req.body;
    const shippingCost = Number(req.body.shippingCost || 0);
    const pointsDiscount = Number(req.body.pointsDiscount || 0);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    await client.query('BEGIN');

    const itemsTotal = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
    const total = itemsTotal + shippingCost - pointsDiscount;

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, total, notes, tracking_data, shipping_cost, points_discount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, addressId, total, notes, trackingData ? JSON.stringify(trackingData) : null, shippingCost, pointsDiscount]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      const snapshot = {
        name: item.name || '',
        originalPrice: Number(item.originalPrice || item.price || 0),
        discountPercent: Number(item.discountPercent || 0),
        price: Number(item.price || 0),
      };
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, snapshot)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.quantity, Number(item.price || 0), snapshot]
      );
    }

    await client.query('COMMIT');

    const fullOrderResult = await client.query(
      `SELECT o.*,
        jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'productId', oi.product_id,
          'quantity', oi.quantity,
          'price', oi.price,
          'originalPrice', (oi.snapshot->>'originalPrice')::numeric,
          'discountPercent', (oi.snapshot->>'discountPercent')::numeric
        )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id`,
      [order.id]
    );

    const orderWithItems = fullOrderResult.rows[0];
    const response = {
      ...orderWithItems,
      tracking: orderWithItems.tracking_data,
    };

    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order' });
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id - Update order status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error updating order' });
  }
});

export default router;
