import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/products - Get all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, brand, search, available } = req.query;
    
    let query = `
      SELECT p.*, b.name as brand_name, b.logo as brand_logo, 
             c.name as category_name, c.icon as category_icon
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND p.category_id = $${paramIndex++}`;
      params.push(category);
    }
    if (brand) {
      query += ` AND p.brand_id = $${paramIndex++}`;
      params.push(brand);
    }
    if (available !== undefined) {
      query += ` AND p.available = $${paramIndex++}`;
      params.push(available === 'true');
    }
    if (search) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY p.name ASC';

    const result = await pool.query(query, params);
    
    // Get vehicle compatibility for each product
    const products = await Promise.all(
      result.rows.map(async (product) => {
        const vehicleResult = await pool.query(
          'SELECT * FROM vehicle_compatibility WHERE product_id = $1',
          [product.id]
        );
        return {
          ...product,
          brand: { id: product.brand_id, name: product.brand_name, logo: product.brand_logo },
          category: { id: product.category_id, name: product.category_name, icon: product.category_icon },
          vehicles: vehicleResult.rows,
        };
      })
    );

    // Remove duplicate fields
    const cleanedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      available: p.available,
      description: p.description,
      brand: p.brand,
      category: p.category,
      vehicles: p.vehicles,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    res.json(cleanedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const productResult = await pool.query(
      `SELECT p.*, b.name as brand_name, b.logo as brand_logo, 
              c.name as category_name, c.icon as category_icon
       FROM products p
       JOIN brands b ON p.brand_id = b.id
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    const vehicleResult = await pool.query(
      'SELECT * FROM vehicle_compatibility WHERE product_id = $1',
      [id]
    );

    res.json({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      available: product.available,
      description: product.description,
      brand: { id: product.brand_id, name: product.brand_name, logo: product.brand_logo },
      category: { id: product.category_id, name: product.category_name, icon: product.category_icon },
      vehicles: vehicleResult.rows,
      created_at: product.created_at,
      updated_at: product.updated_at,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// POST /api/products - Create product
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, brandId, categoryId, price, image, available, description, vehicles } = req.body;

    const result = await pool.query(
      `INSERT INTO products (id, name, brand_id, category_id, price, image, available, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, name, brandId, categoryId, price, image, available ?? true, description]
    );

    // Insert vehicle compatibility if provided
    if (vehicles && vehicles.length > 0) {
      for (const vehicle of vehicles) {
        await pool.query(
          `INSERT INTO vehicle_compatibility (product_id, brands, models, year_start, year_end, engines, oem_numbers)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            vehicle.brands,
            JSON.stringify(vehicle.models),
            vehicle.yearStart,
            vehicle.yearEnd,
            vehicle.engines,
            vehicle.oemNumbers,
          ]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Error creating product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, brandId, categoryId, price, image, available, description } = req.body;

    const result = await pool.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           brand_id = COALESCE($2, brand_id),
           category_id = COALESCE($3, category_id),
           price = COALESCE($4, price),
           image = COALESCE($5, image),
           available = COALESCE($6, available),
           description = COALESCE($7, description),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, brandId, categoryId, price, image, available, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error updating product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM vehicle_compatibility WHERE product_id = $1', [id]);
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product' });
  }
});

export default router;
