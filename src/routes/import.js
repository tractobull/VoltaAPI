import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return ['true', '1', 'yes', 'sí', 'si', 'y'].includes(val.trim().toLowerCase());
  return true;
}

router.post('/products', authenticate, authorize('ADMIN'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { products, mode } = req.body;
    // mode: 'create' (only inserts new), 'upsert' (insert or update)

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Se requiere un arreglo de productos' });
    }

    const errors = [];
    const created = [];
    const updated = [];

    await client.query('BEGIN');

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const rowNum = i + 1;

      if (!p.name || !p.brand_id || !p.category_id || !p.price) {
        errors.push({ row: rowNum, error: 'Faltan campos requeridos (name, brand_id, category_id, price)' });
        continue;
      }

      try {
        if (mode === 'upsert' && p.id) {
          const existing = await client.query('SELECT id FROM products WHERE id = $1', [p.id]);
          if (existing.rows.length > 0) {
            await client.query(`
              UPDATE products SET
                name = $1, brand_id = $2, category_id = $3,
                price = $4, image = $5, available = $6,
                description = $7, discount_percent = $8,
                updated_at = NOW()
              WHERE id = $9
            `, [
              p.name, p.brand_id, p.category_id, Number(p.price),
              p.image || null, parseBool(p.available),
              p.description || null, Number(p.discount_percent || 0),
              p.id,
            ]);
            updated.push({ row: rowNum, id: p.id, name: p.name });
            continue;
          }
        }

        const columns = ['name', 'brand_id', 'category_id', 'price', 'image', 'available', 'description', 'discount_percent'];
        const vals = [
          p.name, p.brand_id, p.category_id, Number(p.price),
          p.image || null, parseBool(p.available),
          p.description || null, Number(p.discount_percent || 0),
        ];
        if (p.id) {
          columns.unshift('id');
          vals.unshift(p.id);
        }

        const query = mode === 'create' && p.id
          ? `INSERT INTO products (${columns.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING RETURNING id`
          : `INSERT INTO products (${columns.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`;

        const result = await client.query(query, vals);

        if (result.rows.length > 0) {
          created.push({ row: rowNum, id: result.rows[0].id, name: p.name });
        }
      } catch (err) {
        errors.push({ row: rowNum, error: err.message, name: p.name });
      }
    }

    await client.query('COMMIT');

    res.json({
      created: created.length,
      updated: updated.length,
      errors: errors.length,
      errorDetails: errors,
      createdItems: created,
      updatedItems: updated,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing products:', error);
    res.status(500).json({ error: 'Error al importar productos' });
  } finally {
    client.release();
  }
});

router.post('/categories', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { categories, mode } = req.body;

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Se requiere un arreglo de categorías' });
    }

    const errors = [];
    const created = [];
    const updated = [];

    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      const rowNum = i + 1;

      if (!c.id || !c.name) {
        errors.push({ row: rowNum, error: 'Faltan campos requeridos (id, name)' });
        continue;
      }

      try {
        if (mode === 'upsert') {
          const existing = await pool.query('SELECT id FROM categories WHERE id = $1', [c.id]);
          if (existing.rows.length > 0) {
            await pool.query(
              'UPDATE categories SET name = $1, icon = $2 WHERE id = $3',
              [c.name, c.icon || null, c.id]
            );
            updated.push({ row: rowNum, id: c.id, name: c.name });
            continue;
          }
        }

        await pool.query(
          'INSERT INTO categories (id, name, icon) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, icon = $3',
          [c.id, c.name, c.icon || null]
        );
        created.push({ row: rowNum, id: c.id, name: c.name });
      } catch (err) {
        errors.push({ row: rowNum, error: err.message, name: c.name });
      }
    }

    res.json({
      created: created.length,
      updated: updated.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Error importing categories:', error);
    res.status(500).json({ error: 'Error al importar categorías' });
  }
});

router.post('/brands', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { brands, mode } = req.body;

    if (!Array.isArray(brands) || brands.length === 0) {
      return res.status(400).json({ error: 'Se requiere un arreglo de marcas' });
    }

    const errors = [];
    const created = [];
    const updated = [];

    for (let i = 0; i < brands.length; i++) {
      const b = brands[i];
      const rowNum = i + 1;

      if (!b.id || !b.name) {
        errors.push({ row: rowNum, error: 'Faltan campos requeridos (id, name)' });
        continue;
      }

      try {
        if (mode === 'upsert') {
          const existing = await pool.query('SELECT id FROM brands WHERE id = $1', [b.id]);
          if (existing.rows.length > 0) {
            await pool.query(
              'UPDATE brands SET name = $1, logo = $2 WHERE id = $3',
              [b.name, b.logo || null, b.id]
            );
            updated.push({ row: rowNum, id: b.id, name: b.name });
            continue;
          }
        }

        await pool.query(
          'INSERT INTO brands (id, name, logo) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, logo = $3',
          [b.id, b.name, b.logo || null]
        );
        created.push({ row: rowNum, id: b.id, name: b.name });
      } catch (err) {
        errors.push({ row: rowNum, error: err.message, name: b.name });
      }
    }

    res.json({
      created: created.length,
      updated: updated.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Error importing brands:', error);
    res.status(500).json({ error: 'Error al importar marcas' });
  }
});

router.post('/inventory', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un arreglo de items de inventario' });
    }

    const errors = [];
    const processed = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;

      if (!item.product_id || !item.warehouse_id || item.stock === undefined) {
        errors.push({ row: rowNum, error: 'Faltan campos requeridos (product_id, warehouse_id, stock)' });
        continue;
      }

      try {
        await pool.query(`
          INSERT INTO inventory (product_id, warehouse_id, stock)
          VALUES ($1, $2, $3)
          ON CONFLICT (product_id, warehouse_id)
          DO UPDATE SET stock = $3, updated_at = NOW()
        `, [item.product_id, item.warehouse_id, Number(item.stock)]);
        processed.push(rowNum);
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }

    res.json({
      processed: processed.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Error importing inventory:', error);
    res.status(500).json({ error: 'Error al importar inventario' });
  }
});

export default router;
