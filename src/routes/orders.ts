import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/orders - Get all orders
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price
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
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'name', p.name,
        'quantity', oi.quantity,
        'price', oi.price
      )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
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
router.post('/', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    const { userId, addressId, items, notes, trackingData } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }
    
    await client.query('BEGIN');
    
    // Calculate total
    let total = 0;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT price FROM products WHERE id = $1',
        [item.productId]
      );
      if (productResult.rows.length > 0) {
        total += Number(productResult.rows[0].price) * item.quantity;
      }
    }
    
    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, total, notes, tracking_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, addressId, total, notes, trackingData ? JSON.stringify(trackingData) : null]
    );
    
    const order = orderResult.rows[0];
    
    // Create order items
    for (const item of items) {
      const productResult = await client.query(
        'SELECT price FROM products WHERE id = $1',
        [item.productId]
      );
      
      if (productResult.rows.length > 0) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.productId, item.quantity, productResult.rows[0].price]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch complete order with items
    const completeOrder = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price
      )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id`,
      [order.id]
    );
    
    res.status(201).json(completeOrder.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order' });
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id - Update order status
router.put('/:id', async (req: Request, res: Response) => {
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
