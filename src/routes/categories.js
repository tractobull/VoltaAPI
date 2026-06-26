import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/categories - Get all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

// GET /api/categories/:id - Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Error al obtener la categoría' });
  }
});

// POST /api/categories - Create category
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id, name, icon } = req.body;
    const result = await pool.query(
      'INSERT INTO categories (id, name, icon) VALUES ($1, $2, $3) RETURNING *',
      [id, name, icon]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), icon = COALESCE($2, icon) WHERE id = $3 RETURNING *',
      [name, icon, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

export default router;
