import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getIO } from '../websocket/index.js';

const router = Router();

// GET /api/orders - Get all orders
router.get('/', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone, json_agg(json_build_object(
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
      LEFT JOIN users u ON o.user_id = u.id
      GROUP BY o.id, u.name, u.email, u.phone
      ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[Orders] Error fetching orders:', error);
    res.status(500).json({ error: 'Error al obtener las órdenes', details: error.message });
  }
});

// GET /api/orders/:id - Get order by ID
router.get('/:id', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
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
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
});

// GET /api/orders/user/:userId - Get orders by user
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Users can only see their own orders; admins/support can see any
    if (req.user.id !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver estas ordenes' });
    }
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
    res.status(500).json({ error: 'Error al obtener las órdenes del usuario' });
  }
});

// POST /api/orders/split-preview - Preview how an order would be split across warehouses
router.post('/split-preview', authenticate, async (req, res) => {
  try {
    const { items, lat, lng, preferredWarehouseId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron artículos' });
    }

    // For each product, find warehouses that have stock, ordered by distance
    const productWarehouses = [];
    for (const item of items) {
      let query;
      let params;

      if (lat && lng) {
        query = `
          SELECT i.warehouse_id, i.stock, w.name as warehouse_name, w.address as warehouse_address,
            w.lat, w.lng,
            ROUND((6371 * acos(
              cos(radians($1)) * cos(radians(w.lat)) *
              cos(radians(w.lng) - radians($2)) +
              sin(radians($1)) * sin(radians(w.lat))
            ))::numeric, 1) AS distance_km
          FROM inventory i
          JOIN warehouses w ON i.warehouse_id = w.id
          WHERE i.product_id = $3 AND i.stock >= $4 AND w.active = true
            AND w.lat IS NOT NULL AND w.lng IS NOT NULL
          ORDER BY
            CASE WHEN $5::uuid IS NOT NULL AND i.warehouse_id = $5::uuid THEN 0 ELSE 1 END,
            distance_km ASC
        `;
        params = [parseFloat(lat), parseFloat(lng), item.productId, item.quantity, preferredWarehouseId || null];
      } else {
        query = `
          SELECT i.warehouse_id, i.stock, w.name as warehouse_name, w.address as warehouse_address,
            w.lat, w.lng,
            0 AS distance_km
          FROM inventory i
          JOIN warehouses w ON i.warehouse_id = w.id
          WHERE i.product_id = $1 AND i.stock >= $2 AND w.active = true
          ORDER BY
            CASE WHEN $3::uuid IS NOT NULL AND i.warehouse_id = $3::uuid THEN 0 ELSE 1 END,
            w.name ASC
        `;
        params = [item.productId, item.quantity, preferredWarehouseId || null];
      }

      const result = await pool.query(query, params);
      productWarehouses.push({
        ...item,
        warehouses: result.rows,
      });
    }

    // Greedy grouping: assign each product to the nearest warehouse that has stock
    // If a warehouse is already in a group, prefer it to consolidate
    const groups = {}; // warehouseId -> { warehouse, items }

    for (const pw of productWarehouses) {
      if (pw.warehouses.length === 0) {
        // No warehouse has stock - assign to null (will fail later)
        if (!groups['__unavailable__']) {
          groups['__unavailable__'] = { warehouse: null, items: [] };
        }
        groups['__unavailable__'].items.push(pw);
        continue;
      }

      // Find the best warehouse: prefer one already in a group, then nearest
      let assigned = false;

      // First try to assign to an existing group's warehouse that has stock
      for (const gid of Object.keys(groups)) {
        if (gid === '__unavailable__') continue;
        const existing = groups[gid];
        const match = pw.warehouses.find((w) => w.warehouse_id === existing.warehouse.id);
        if (match) {
          existing.items.push(pw);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        // Assign to nearest warehouse
        const best = pw.warehouses[0];
        const wid = best.warehouse_id;
        if (!groups[wid]) {
          groups[wid] = {
            warehouse: {
              id: wid,
              name: best.warehouse_name,
              address: best.warehouse_address,
              lat: best.lat,
              lng: best.lng,
              distance_km: best.distance_km,
            },
            items: [],
          };
        }
        groups[wid].items.push(pw);
      }
    }

    const splits = Object.values(groups).map((g) => ({
      warehouse: g.warehouse,
      items: g.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
        originalPrice: i.originalPrice,
        discountPercent: i.discountPercent,
      })),
    }));

    const unavailable = groups['__unavailable__'];
    res.json({
      splits,
      needsSplit: splits.length > 1,
      hasUnavailable: !!unavailable,
      unavailableItems: unavailable ? unavailable.items.map((i) => i.productId) : [],
    });
  } catch (error) {
    console.error('Error in split-preview:', error);
    res.status(500).json({ error: 'Error calculando la división' });
  }
});

// POST /api/orders/split - Create multiple orders from split items
router.post('/split', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId, addressId, splits, notes, trackingData, deliveryCoordinates, shippingCosts, pointsDiscount } = req.body;

    if (!splits || splits.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron divisiones' });
    }

    await client.query('BEGIN');

    const createdOrders = [];
    const totalShippingCost = Number(shippingCosts?.total || 0);
    const totalPointsDiscount = Number(pointsDiscount || 0);
    const splitSubtotals = splits.map((split) =>
      split.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
    );
    const subtotalAll = splitSubtotals.reduce((sum, subtotal) => sum + subtotal, 0);

    if (totalPointsDiscount > 0 && userId) {
      const userResult = await client.query('SELECT points FROM users WHERE id = $1', [userId]);
      const currentPoints = Number(userResult.rows[0]?.points || 0);
      if (currentPoints < totalPointsDiscount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No tienes suficientes puntos Volta' });
      }
    }

    for (const [index, split] of splits.entries()) {
      const { warehouseId, items } = split;
      const splitTrackingData = split.trackingData || trackingData;

      if (!warehouseId || !items || items.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cada división debe tener un identificador de almacén y artículos' });
      }

      // Verify stock
      for (const item of items) {
        const stockResult = await client.query(
          `SELECT stock FROM inventory WHERE warehouse_id = $1 AND product_id = $2`,
          [warehouseId, item.productId]
        );
        const availableStock = Number(stockResult.rows[0]?.stock || 0);
        if (availableStock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `No hay suficiente stock para el producto ${item.name} en el almacén ${warehouseId}. Disponible: ${availableStock}, Solicitado: ${item.quantity}`
          });
        }
      }

      const itemsTotal = splitSubtotals[index];
      const perOrderShipping = splits.length > 0 ? totalShippingCost / splits.length : 0;
      const proportionalDiscount = subtotalAll > 0
        ? (itemsTotal / subtotalAll) * totalPointsDiscount
        : totalPointsDiscount / splits.length;
      const perOrderDiscount = Math.min(proportionalDiscount, itemsTotal + perOrderShipping);
      const total = Math.max(itemsTotal + perOrderShipping - perOrderDiscount, 0);

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, address_id, warehouse_id, total, notes, tracking_data, shipping_cost, points_discount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, addressId, warehouseId, total, notes, splitTrackingData ? JSON.stringify(splitTrackingData) : null, perOrderShipping, perOrderDiscount]
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

        // Deduct inventory
        await client.query(
          `UPDATE inventory SET stock = stock - $1 WHERE warehouse_id = $2 AND product_id = $3`,
          [item.quantity, warehouseId, item.productId]
        );
      }

      const orderShort = order.id.slice(0, 8).toUpperCase();
      const notificationResult = await pool.query(
        `INSERT INTO notifications (user_id, type, title, description, icon, data)
         VALUES ($1, 'order', $2, $3, 'package', $4)
         RETURNING *`,
        [
          userId,
          `Pedido ${orderShort} creado`,
          `Tu pedido por $${total.toFixed(2)} ha sido registrado.`,
          JSON.stringify({ orderId: order.id }),
        ]
      );

      // Emit websocket event for real-time notification
      const io = getIO();
      if (io) {
        io.to(`user:${userId}`).emit('new_notification', notificationResult.rows[0]);
      }

      createdOrders.push({
        ...order,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      });
    }

    if (totalPointsDiscount > 0 && userId) {
      await client.query(
        'UPDATE users SET points = points - $1, updated_at = NOW() WHERE id = $2',
        [totalPointsDiscount, userId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ orders: createdOrders });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating split orders:', error);
    res.status(500).json({ error: 'Error al crear los pedidos divididos' });
  } finally {
    client.release();
  }
});

// POST /api/orders - Create order
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { userId, addressId, warehouseId, items, notes, trackingData, deliveryMethod, deliveryCoordinates } = req.body;
    const shippingCost = Number(req.body.shippingCost || 0);
    const pointsDiscount = Number(req.body.pointsDiscount || 0);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un artículo' });
    }

    await client.query('BEGIN');

    // Determine warehouse
    let finalWarehouseId = warehouseId;
    
    // Only auto-assign warehouse if not provided AND it's a delivery order
    if (!finalWarehouseId && deliveryMethod === 'delivery' && deliveryCoordinates) {
      // Use the provided warehouseId directly - frontend already grouped items by warehouse
      // Don't try to find a single warehouse for all items
      if (!warehouseId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El identificador del almacén es requerido para pedidos de entrega' });
      }
      finalWarehouseId = warehouseId;
    }

    if (!finalWarehouseId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay almacén disponible con stock para este pedido' });
    }

    // Verify stock availability
    for (const item of items) {
      const stockResult = await client.query(
        `SELECT COALESCE(SUM(stock), 0) as available_stock
         FROM inventory
         WHERE warehouse_id = $1 AND product_id = $2`,
        [finalWarehouseId, item.productId]
      );
      
      const availableStock = Number(stockResult.rows[0]?.available_stock || 0);
      if (availableStock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `No hay suficiente stock para el producto ${item.name}. Disponible: ${availableStock}, Solicitado: ${item.quantity}` 
        });
      }
    }

    const itemsTotal = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
    const total = Math.max(itemsTotal + shippingCost - pointsDiscount, 0);

    if (pointsDiscount > 0 && userId) {
      const userResult = await client.query('SELECT points FROM users WHERE id = $1', [userId]);
      const currentPoints = Number(userResult.rows[0]?.points || 0);
      if (currentPoints < pointsDiscount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No tienes suficientes puntos Volta' });
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, address_id, warehouse_id, total, notes, tracking_data, shipping_cost, points_discount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, addressId, finalWarehouseId, total, notes, trackingData ? JSON.stringify(trackingData) : null, shippingCost, pointsDiscount]
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

      // Deduct stock from inventory
      await client.query(
        `UPDATE inventory
         SET stock = stock - $1
         WHERE warehouse_id = $2 AND product_id = $3`,
        [item.quantity, finalWarehouseId, item.productId]
      );
    }

    if (pointsDiscount > 0 && userId) {
      await client.query(
        'UPDATE users SET points = points - $1, updated_at = NOW() WHERE id = $2',
        [pointsDiscount, userId]
      );
    }

    await client.query('COMMIT');

    const orderShort = order.id.slice(0, 8).toUpperCase();
    const notificationResult = await pool.query(
      `INSERT INTO notifications (user_id, type, title, description, icon, data)
       VALUES ($1, 'order', $2, $3, 'package', $4)
       RETURNING *`,
      [
        userId,
        `Pedido ${orderShort} creado`,
        `Tu pedido por $${total.toFixed(2)} ha sido registrado exitosamente.`,
        JSON.stringify({ orderId: order.id }),
      ]
    );

    // Emit websocket event for real-time notification
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('new_notification', notificationResult.rows[0]);
    }

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
    res.status(500).json({ error: 'Error al crear la orden' });
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id - Update order status
router.put('/:id', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const statusMessages = {
      PENDING: "Tu pedido ha sido recibido y está pendiente de confirmación.",
      CONFIRMED: "Tu pedido fue confirmado y pronto comenzará su preparación.",
      PROCESSING: "Estamos preparando tu pedido.",
      SHIPPED: "Tu pedido fue enviado y está en camino.",
      DELIVERED: "Tu pedido fue entregado. ¡Gracias por tu compra!",
      CANCELLED: "Tu pedido fue cancelado.",
    };

    // Get order to check it's status
    const orderResult = await pool.query('SELECT status FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const currentStatus = orderResult.rows[0].status;

    if (currentStatus === status) {
      return res.status(400).json({ error: 'La orden ya se encuentra en este estado' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = result.rows[0];
    const orderShort = id.slice(0, 8).toUpperCase();

    const notificationResult = await pool.query(
      `INSERT INTO notifications (user_id, type, title, description, icon, data)
       VALUES ($1, 'order', $2, $3, 'package', $4)
       RETURNING *`,
      [
        order.user_id,
        `Pedido ${orderShort} actualizado`,
        statusMessages[status] ?? "El estado de tu pedido ha cambiado.",
        JSON.stringify({ orderId: id }),
      ]
    );

    // Emit websocket event for real-time notification
    const io = getIO();
    if (io) {
      io.to(`user:${order.user_id}`).emit('new_notification', notificationResult.rows[0]);
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error al actualizar la orden' });
  }
});

export default router;
