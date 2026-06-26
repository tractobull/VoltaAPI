import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/warehouses - Get all active warehouses (public)
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM warehouses WHERE active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Error al obtener los almacenes' });
  }
});

// GET /api/warehouses/all - Get ALL warehouses (admin)
router.get('/all', authenticate, authorize('ADMIN'), async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM warehouses ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all warehouses:', error);
    res.status(500).json({ error: 'Error al obtener los almacenes' });
  }
});

// GET /api/warehouses/nearby?lat=X&lng=Y - Find nearest warehouses (MUST be before /:id)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const result = await pool.query(
      `SELECT *,
        ROUND(
          (6371 * acos(
            cos(radians($1)) * cos(radians(lat)) *
            cos(radians(lng) - radians($2)) +
            sin(radians($1)) * sin(radians(lat))
          ))::numeric, 2
        ) AS distance_km
       FROM warehouses
       WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
       ORDER BY distance_km ASC
       LIMIT $3`,
      [parseFloat(lat), parseFloat(lng), parseInt(limit)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error finding nearby warehouses:', error);
    res.status(500).json({ error: 'Error al encontrar los almacenes cercanos' });
  }
});

// GET /api/warehouses/:id - Get single warehouse with inventory
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const warehouse = await pool.query('SELECT * FROM warehouses WHERE id = $1', [id]);
    if (warehouse.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const inventory = await pool.query(
      `SELECT i.*, p.name as product_name, p.image as product_image,
              p.price, p.available as product_available
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.warehouse_id = $1
       ORDER BY p.name ASC`,
      [id]
    );

    res.json({ ...warehouse.rows[0], inventory: inventory.rows });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Error al obtener el almacén' });
  }
});

// POST /api/warehouses - Create warehouse (admin)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, address, lat, lng, phone } = req.body;
    const result = await pool.query(
      `INSERT INTO warehouses (name, address, lat, lng, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, address, lat || null, lng || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(500).json({ error: 'Error al crear el almacén' });
  }
});

// PUT /api/warehouses/:id - Update warehouse (admin)
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, lat, lng, phone, active } = req.body;
    const result = await pool.query(
      `UPDATE warehouses
       SET name = COALESCE($1, name),
           address = COALESCE($2, address),
           lat = COALESCE($3, lat),
           lng = COALESCE($4, lng),
           phone = COALESCE($5, phone),
           active = COALESCE($6, active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, address, lat, lng, phone, active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Almacén no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Error al actualizar el almacén' });
  }
});

// DELETE /api/warehouses/:id - Delete warehouse (admin)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM warehouses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Almacén no encontrado' });
    }
    res.json({ message: 'Almacén eliminado' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Error al eliminar el almacén' });
  }
});

// --- INVENTORY ---

// GET /api/warehouses/:id/inventory - Get inventory for a warehouse
router.get('/:id/inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT i.*, p.name as product_name, p.image as product_image,
              p.price, p.available as product_available,
              b.name as brand_name
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE i.warehouse_id = $1
       ORDER BY p.name ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Error al obtener el inventario' });
  }
});

// PUT /api/warehouses/:id/inventory - Upsert inventory (admin)
router.put('/:id/inventory', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, stock } = req.body;

    const result = await pool.query(
      `INSERT INTO inventory (product_id, warehouse_id, stock)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, warehouse_id)
       DO UPDATE SET stock = $3, updated_at = NOW()
       RETURNING *`,
      [productId, id, stock]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Error al actualizar el inventario' });
  }
});

// DELETE /api/warehouses/:warehouseId/inventory/:productId - Remove from inventory
router.delete('/:warehouseId/inventory/:productId', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { warehouseId, productId } = req.params;
    const result = await pool.query(
      'DELETE FROM inventory WHERE product_id = $1 AND warehouse_id = $2 RETURNING id',
      [productId, warehouseId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Elemento no encontrado en el inventario' });
    }
    res.json({ message: 'Eliminado del inventario' });
  } catch (error) {
    console.error('Error removing from inventory:', error);
    res.status(500).json({ error: 'Error al eliminar del inventario' });
  }
});

// GET /api/warehouses/:id/stock/:productId - Check stock for a product at a warehouse
router.get('/:id/stock/:productId', async (req, res) => {
  try {
    const { id, productId } = req.params;
    const result = await pool.query(
      `SELECT stock FROM inventory
       WHERE product_id = $1 AND warehouse_id = $2`,
      [productId, id]
    );
    const stock = result.rows.length > 0 ? result.rows[0].stock : 0;
    res.json({ stock });
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ error: 'Error al verificar el stock' });
  }
});

// POST /api/warehouses/check-inventory - Check inventory for multiple products at nearby warehouses
router.post('/check-inventory', async (req, res) => {
  try {
    const { productIds, lat, lng } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de IDs de productos' });
    }

    const hasCoords = lat && lng;

    // Find warehouses with inventory for the requested products
    const result = await pool.query(
      `SELECT w.*,
        ${hasCoords ? `ROUND(
            (6371 * acos(
              cos(radians($1)) * cos(radians(w.lat)) *
              cos(radians(w.lng) - radians($2)) +
              sin(radians($1)) * sin(radians(w.lat))
            ))::numeric, 2
          )` : 'NULL'} AS distance_km,
        COALESCE(SUM(i.stock), 0) as total_stock
       FROM warehouses w
       LEFT JOIN inventory i ON w.id = i.warehouse_id AND i.product_id = ANY($${hasCoords ? 3 : 1})
       WHERE w.active = true ${hasCoords ? 'AND w.lat IS NOT NULL AND w.lng IS NOT NULL' : ''}
       GROUP BY w.id
       HAVING COALESCE(SUM(i.stock), 0) > 0
       ORDER BY ${hasCoords ? 'distance_km ASC' : 'w.name ASC'}`,
      hasCoords ? [parseFloat(lat), parseFloat(lng), productIds] : [productIds]
    );

    // For each warehouse, get detailed stock per product
    const warehousesWithStock = await Promise.all(
      result.rows.map(async (warehouse) => {
        const stockResult = await pool.query(
          `SELECT product_id, stock
           FROM inventory
           WHERE warehouse_id = $1 AND product_id = ANY($2)`,
          [warehouse.id, productIds]
        );

        const products = stockResult.rows.map(row => ({
          productId: row.product_id,
          stock: row.stock,
        }));

        const allAvailable = productIds.every(pid =>
          products.some(p => p.productId === pid && p.stock > 0)
        );

        return {
          id: warehouse.id,
          name: warehouse.name,
          address: warehouse.address,
          lat: warehouse.lat,
          lng: warehouse.lng,
          distance: Number(warehouse.distance_km),
          products,
          allAvailable,
        };
      })
    );

    res.json({ warehouses: warehousesWithStock });
  } catch (error) {
    console.error('Error checking inventory:', error);
    res.status(500).json({ error: 'Error al verificar el inventario' });
  }
});

export default router;
