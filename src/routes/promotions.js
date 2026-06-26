import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/promotions - Get active promotions for hero banner
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, pr.name as product_name, pr.price as product_price, 
              pr.discount_percent, pr.image as product_image, b.name as brand_name
       FROM promotions p
       LEFT JOIN products pr ON p.product_id = pr.id
       LEFT JOIN brands b ON pr.brand_id = b.id
       WHERE p.active = true
       ORDER BY p.sort_order DESC, p.created_at DESC`
    );

    const promotions = result.rows.map((row) => {
      const base = {
        id: row.id,
        type: row.type,
        eyebrow: row.eyebrow,
        title: row.title,
        subtitle: row.subtitle,
        link: row.link,
        image: row.image,
        icon: row.icon,
      };

      if (row.type === 'product' && row.product_id) {
        const price = Number(row.product_price);
        const discount = Number(row.discount_percent) || 0;
        const discountedPrice = discount > 0
          ? Math.round(price * (1 - discount / 100) * 100) / 100
          : price;
        const productImage = row.product_image || row.image;

        return {
          ...base,
          productId: row.product_id,
          price,
          discountedPrice,
          discountPercent: discount,
          image: productImage ? productImage + (row.updated_at ? `${productImage.includes('?') ? '&' : '?'}v=${new Date(row.updated_at).getTime()}` : '') : null,
          brand: row.brand_name,
        };
      }

      return {
        ...base,
        image: row.image ? row.image + (row.updated_at ? `${row.image.includes('?') ? '&' : '?'}v=${new Date(row.updated_at).getTime()}` : '') : null,
      };
    });

    res.json(promotions);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Error al obtener las promociones' });
  }
});

// GET /api/promotions/all - Get ALL promotions for admin (active + inactive)
router.get('/all', authenticate, authorize('ADMIN'), async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, pr.name as product_name, pr.price as product_price,
              pr.discount_percent, pr.image as product_image, b.name as brand_name
       FROM promotions p
       LEFT JOIN products pr ON p.product_id = pr.id
       LEFT JOIN brands b ON pr.brand_id = b.id
       ORDER BY p.sort_order DESC, p.created_at DESC`
    );

    const promotions = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      eyebrow: row.eyebrow,
      title: row.title,
      subtitle: row.subtitle,
      link: row.link,
      image: row.image,
      icon: row.icon,
      sort_order: row.sort_order,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    res.json(promotions);
  } catch (error) {
    console.error('Error fetching all promotions:', error);
    res.status(500).json({ error: 'Error al obtener todas las promociones' });
  }
});

// POST /api/promotions - Create promotion (admin)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id, type, eyebrow, title, subtitle, link, image, icon, productId, sortOrder, active } = req.body;

    const result = await pool.query(
      `INSERT INTO promotions (id, type, eyebrow, title, subtitle, link, image, icon, product_id, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, type, eyebrow, title, subtitle, link, image, icon, productId, sortOrder ?? 0, active ?? true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Error al crear la promoción' });
  }
});

// PUT /api/promotions/:id - Update promotion (admin)
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, eyebrow, title, subtitle, link, image, icon, productId, sortOrder, active } = req.body;

    const result = await pool.query(
      `UPDATE promotions 
       SET type = COALESCE($1, type),
           eyebrow = COALESCE($2, eyebrow),
           title = COALESCE($3, title),
           subtitle = COALESCE($4, subtitle),
           link = COALESCE($5, link),
           image = COALESCE($6, image),
           icon = COALESCE($7, icon),
           product_id = COALESCE($8, product_id),
           sort_order = COALESCE($9, sort_order),
           active = COALESCE($10, active),
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [type, eyebrow, title, subtitle, link, image, icon, productId, sortOrder, active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ error: 'Error al actualizar la promoción' });
  }
});

// DELETE /api/promotions/:id - Delete promotion (admin)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM promotions WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json({ message: 'Promoción eliminada' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ error: 'Error al eliminar la promoción' });
  }
});

export default router;
