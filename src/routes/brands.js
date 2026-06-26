import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/brands - Get all brands
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Error al obtener las marcas' });
  }
});

// GET /api/brands/:id - Get brand by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Error al obtener la marca' });
  }
});

// POST /api/brands - Create brand
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id, name, logo } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (id, name, logo) VALUES ($1, $2, $3) RETURNING *',
      [id, name, logo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Error al crear la marca' });
  }
});

// PUT /api/brands/:id - Update brand
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo } = req.body;
    const result = await pool.query(
      'UPDATE brands SET name = COALESCE($1, name), logo = COALESCE($2, logo) WHERE id = $3 RETURNING *',
      [name, logo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Error al actualizar la marca' });
  }
});

// DELETE /api/brands/:id - Delete brand
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM brands WHERE id = $1', [id]);
    res.json({ message: 'Marca eliminada' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Error al eliminar la marca' });
  }
});

export default router;
