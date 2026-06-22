import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

// GET /api/products/search - Search products with pagination
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, brand, page, limit } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (category) {
      whereClause += ` AND p.category_id = $${paramIndex++}`;
      params.push(category);
    }
    if (brand) {
      whereClause += ` AND p.brand_id = $${paramIndex++}`;
      params.push(brand);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p JOIN brands b ON p.brand_id = b.id ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const query = `
      SELECT p.*, b.name as brand_name, b.logo as brand_logo, 
             c.name as category_name, c.icon as category_icon
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limitNum, offset);

    const result = await pool.query(query, params);
    
    const products = await Promise.all(result.rows.map(async (product) => {
      const vehicleResult = await pool.query(
        'SELECT * FROM vehicle_compatibility WHERE product_id = $1',
        [product.id]
      );
      return {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        image: product.image,
        available: product.available,
        description: product.description,
        brand: product.brand_name,
        categoryId: product.category_id,
        vehicleCompatibility: vehicleResult.rows[0] || null,
        created_at: product.created_at,
        updated_at: product.updated_at,
      };
    }));

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Error searching products' });
  }
});

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
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY p.name ASC';

    const result = await pool.query(query, params);
    
    const products = await Promise.all(
      result.rows.map(async (product) => {
        const vehicleResult = await pool.query(
          'SELECT * FROM vehicle_compatibility WHERE product_id = $1',
          [product.id]
        );
        return {
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
        };
      })
    );

    res.json(products);
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
