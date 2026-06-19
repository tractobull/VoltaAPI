import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/brands - Get all brands
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Error fetching brands' });
  }
});

// GET /api/brands/:id - Get brand by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM brands WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Error fetching brand' });
  }
});

// POST /api/brands - Create brand
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, logo } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (id, name, logo) VALUES ($1, $2, $3) RETURNING *',
      [id, name, logo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Error creating brand' });
  }
});

// PUT /api/brands/:id - Update brand
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, logo } = req.body;
    const result = await pool.query(
      'UPDATE brands SET name = COALESCE($1, name), logo = COALESCE($2, logo) WHERE id = $3 RETURNING *',
      [name, logo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Error updating brand' });
  }
});

// DELETE /api/brands/:id - Delete brand
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM brands WHERE id = $1', [id]);
    res.json({ message: 'Brand deleted' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Error deleting brand' });
  }
});

export default router;
