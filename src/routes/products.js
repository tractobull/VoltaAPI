import { Router } from 'express';
import pool from '../db/pool.js';
import { ChatService } from '../services/chatService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
const chatService = new ChatService();

// GET /api/products/inventory-check - Check inventory across warehouses for cart items
router.get('/inventory-check', async (req, res) => {
  try {
    const { productIds, lat, lng } = req.query;
    
    if (!productIds) {
      return res.status(400).json({ error: 'Se requieren los IDs de los productos' });
    }

    const productIdArray = Array.isArray(productIds) ? productIds : productIds.split(',');
    
    // Get inventory for all warehouses for these products
    const inventoryResult = await pool.query(
      `SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.lat,
        w.lng,
        i.product_id,
        i.stock,
        p.name as product_name
       FROM warehouses w
       LEFT JOIN inventory i ON w.id = i.warehouse_id
       LEFT JOIN products p ON i.product_id = p.id
       WHERE w.active = true 
         AND (i.product_id = ANY($1) OR i.product_id IS NULL)
       ORDER BY w.id, i.product_id`,
      [productIdArray]
    );

    // Group by warehouse
    const warehouseMap = new Map();
    inventoryResult.rows.forEach(row => {
      if (!warehouseMap.has(row.warehouse_id)) {
        warehouseMap.set(row.warehouse_id, {
          id: row.warehouse_id,
          name: row.warehouse_name,
          lat: row.lat,
          lng: row.lng,
          products: [],
          distance: null
        });
      }
      
      if (row.product_id) {
        warehouseMap.get(row.warehouse_id).products.push({
          productId: row.product_id,
          productName: row.product_name,
          stock: row.stock
        });
      }
    });

    // Calculate distances if coordinates provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      
      warehouseMap.forEach(warehouse => {
        if (warehouse.lat && warehouse.lng) {
          const R = 6371; // Earth's radius in km
          const dLat = (warehouse.lat - userLat) * Math.PI / 180;
          const dLon = (warehouse.lng - userLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLat * Math.PI / 180) * Math.cos(warehouse.lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          warehouse.distance = R * c;
        }
      });
    }

    // Convert to array and sort by distance if available
    const warehouses = Array.from(warehouseMap.values());
    if (lat && lng) {
      warehouses.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    res.json({ warehouses });
  } catch (error) {
    console.error('Error checking inventory:', error);
    res.status(500).json({ error: 'Error al verificar el inventario' });
  }
});

// GET /api/products/search - Search products with pagination
router.get('/search', async (req, res) => {
  try {
    const { q, category, brand, page, limit } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (q && q !== '' && q !== null && q !== undefined) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (category && category !== '' && category !== null && category !== undefined) {
      whereClause += ` AND p.category_id = $${paramIndex++}`;
      params.push(category);
    }
    if (brand && brand !== '' && brand !== null && brand !== undefined) {
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
             c.name as category_name, c.icon as category_icon,
             COALESCE(SUM(i.stock), 0) as total_stock
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause}
      GROUP BY p.id, b.name, b.logo, c.name, c.icon
      ORDER BY p.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limitNum, offset);

    const result = await pool.query(query, params);
    
    // Batch fetch vehicle compatibility for all products (avoids N+1)
    const productIds = result.rows.map((p) => p.id);
    let vehicleMap = {};
    if (productIds.length > 0) {
      const vehicleResult = await pool.query(
        'SELECT * FROM vehicle_compatibility WHERE product_id = ANY($1)',
        [productIds]
      );
      vehicleResult.rows.forEach((v) => {
        if (!vehicleMap[v.product_id]) vehicleMap[v.product_id] = [];
        vehicleMap[v.product_id].push(v);
      });
    }

    const products = result.rows.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      discountedPrice: product.discount_percent > 0 
        ? Math.round(Number(product.price) * (1 - Number(product.discount_percent) / 100) * 100) / 100 
        : Number(product.price),
      discountPercent: Number(product.discount_percent) || 0,
      image: product.image,
      available: product.available,
      description: product.description,
      brand: product.brand_name,
      categoryId: product.category_id,
      totalStock: Number(product.total_stock) || 0,
      vehicleCompatibility: vehicleMap[product.id]?.[0] || null,
      created_at: product.created_at,
      updated_at: product.updated_at,
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
    res.status(500).json({ error: 'Error al buscar productos' });
  }
});

// POST /api/products/ai-search - Search products using AI
router.post('/ai-search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Se requiere una consulta' });
    }

    const result = await chatService.sendMessage([
      { role: 'user', content: `Busca productos de repuestos para camiones pesados relacionados con: "${query}". Responde SOLO en español listando los productos más relevantes de nuestro catálogo. Usa EXACTAMENTE el formato [producto:id] para cada producto. Máximo 3 productos. Si no hay coincidencias, di que no encontraste productos.` }
    ]);

    res.json({ content: result.content, sessionId: result.sessionId });
  } catch (error) {
    console.error('Error in AI search:', error);
    res.status(500).json({ error: 'Error al buscar productos con IA' });
  }
});

// GET /api/products - Get all products
router.get('/', async (req, res) => {
  try {
    const { category, brand, search, available } = req.query;
    
    let query = `
      SELECT p.*, b.name as brand_name, b.logo as brand_logo, 
             c.name as category_name, c.icon as category_icon,
             COALESCE(SUM(i.stock), 0) as total_stock
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (available !== undefined && available !== '' && available !== null) {
      query += ` AND p.available = $${paramIndex++}`;
      params.push(available === 'true' || available === true);
    }
    if (category && category !== '' && category !== null && category !== undefined) {
      query += ` AND p.category_id = $${paramIndex++}`;
      params.push(String(category));
    }
    if (brand && brand !== '' && brand !== null && brand !== undefined) {
      query += ` AND p.brand_id = $${paramIndex++}`;
      params.push(String(brand));
    }
    if (search && search !== '' && search !== null && search !== undefined) {
      query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
      params.push(`%${String(search)}%`);
      paramIndex++;
    }

    query += ' GROUP BY p.id, b.name, b.logo, c.name, c.icon ORDER BY p.name ASC';

    const result = await pool.query(query, params);
    
    // Batch fetch vehicle compatibility for all products (avoids N+1)
    const productIds = result.rows.map((p) => p.id);
    let vehicleMap = {};
    if (productIds.length > 0) {
      const vehicleResult = await pool.query(
        'SELECT * FROM vehicle_compatibility WHERE product_id = ANY($1)',
        [productIds]
      );
      vehicleResult.rows.forEach((v) => {
        if (!vehicleMap[v.product_id]) vehicleMap[v.product_id] = [];
        vehicleMap[v.product_id].push(v);
      });
    }

    const products = result.rows.map((product) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      discountedPrice: product.discount_percent > 0 
        ? Math.round(Number(product.price) * (1 - Number(product.discount_percent) / 100) * 100) / 100 
        : Number(product.price),
      discountPercent: Number(product.discount_percent) || 0,
      image: product.image,
      available: product.available,
      description: product.description,
      brand: { id: product.brand_id, name: product.brand_name, logo: product.brand_logo },
      category: { id: product.category_id, name: product.category_name, icon: product.category_icon },
      totalStock: Number(product.total_stock) || 0,
      vehicles: vehicleMap[product.id] || [],
      created_at: product.created_at,
      updated_at: product.updated_at,
    }));

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// GET /api/products/featured - Get featured products for home banner
router.get('/featured', async (_req, res) => {
  try {
    const discountedResult = await pool.query(
      `SELECT p.*, b.name as brand_name, COALESCE(SUM(i.stock), 0) as total_stock
       FROM products p 
       JOIN brands b ON p.brand_id = b.id 
       LEFT JOIN inventory i ON p.id = i.product_id
       WHERE p.discount_percent > 0 AND p.available = true 
       GROUP BY p.id, b.name
       ORDER BY p.discount_percent DESC 
       LIMIT 3`
    );

    const popularResult = await pool.query(
      `SELECT p.*, b.name as brand_name, COALESCE(SUM(i.stock), 0) as total_stock
       FROM products p 
       JOIN brands b ON p.brand_id = b.id 
       LEFT JOIN inventory i ON p.id = i.product_id
       WHERE p.available = true 
       GROUP BY p.id, b.name
       ORDER BY p.price DESC 
       LIMIT 6`
    );

    const mapProduct = (p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      discountedPrice: p.discount_percent > 0 
        ? Math.round(Number(p.price) * (1 - Number(p.discount_percent) / 100) * 100) / 100 
        : Number(p.price),
      discountPercent: Number(p.discount_percent) || 0,
      image: p.image,
      available: p.available,
      brand: p.brand_name,
      categoryId: p.category_id,
      totalStock: Number(p.total_stock) || 0,
    });

    res.json({
      discounted: discountedResult.rows.map(mapProduct),
      popular: popularResult.rows.map(mapProduct),
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Error al obtener los productos destacados' });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const productResult = await pool.query(
      `SELECT p.*, b.name as brand_name, b.logo as brand_logo, 
              c.name as category_name, c.icon as category_icon,
              COALESCE(SUM(i.stock), 0) as total_stock
       FROM products p
       JOIN brands b ON p.brand_id = b.id
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN inventory i ON p.id = i.product_id
       WHERE p.id = $1
       GROUP BY p.id, b.name, b.logo, c.name, c.icon`,
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
      price: Number(product.price),
      discountedPrice: product.discount_percent > 0 
        ? Math.round(Number(product.price) * (1 - Number(product.discount_percent) / 100) * 100) / 100 
        : Number(product.price),
      discountPercent: Number(product.discount_percent) || 0,
      image: product.image,
      available: product.available,
      description: product.description,
      brand: { id: product.brand_id, name: product.brand_name, logo: product.brand_logo },
      category: { id: product.category_id, name: product.category_name, icon: product.category_icon },
      totalStock: Number(product.total_stock) || 0,
      vehicles: vehicleResult.rows,
      created_at: product.created_at,
      updated_at: product.updated_at,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

// POST /api/products - Create product
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id, name, brandId, categoryId, price, image, available, description, vehicles, discountPercent } = req.body;

    const columns = ['name', 'brand_id', 'category_id', 'price', 'image', 'available', 'description', 'discount_percent'];
    const values = [name, brandId, categoryId, price, image, available ?? true, description, discountPercent ?? 0];
    const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', '$8'];

    if (id) {
      columns.unshift('id');
      values.unshift(id);
      placeholders.unshift('$1');
      placeholders.shift();
      for (let i = 0; i < values.length; i++) placeholders[i] = `$${i + 1}`;
    }

    const result = await pool.query(
      `INSERT INTO products (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
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
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brandId, categoryId, price, image, available, description, discountPercent } = req.body;

    const result = await pool.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           brand_id = COALESCE($2, brand_id),
           category_id = COALESCE($3, category_id),
           price = COALESCE($4, price),
           image = COALESCE($5, image),
           available = COALESCE($6, available),
           description = COALESCE($7, description),
           discount_percent = COALESCE($8, discount_percent),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, brandId, categoryId, price, image, available, description, discountPercent, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM vehicle_compatibility WHERE product_id = $1', [id]);
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

export default router;
