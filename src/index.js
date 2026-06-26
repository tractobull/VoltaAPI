import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db/pool.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authenticate } from './middleware/auth.js';

// Routes
import productRoutes from './routes/products.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import brandRoutes from './routes/brands.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import promotionRoutes from './routes/promotions.js';
import notificationRoutes from './routes/notifications.js';
import warehouseRoutes from './routes/warehouses.js';

// Initialize
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3001'];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60000, max: 500 }));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/payments', paymentRoutes);

// Global search
app.get('/api/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ products: [], orders: [], users: [] });
    }
    const term = `%${q.trim().toLowerCase()}%`;

    const [products, orders, users] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.price, p.image, p.discount_percent,
                b.name as brand_name, c.name as category_name
         FROM products p
         LEFT JOIN brands b ON p.brand_id = b.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE LOWER(p.name) LIKE $1 OR LOWER(b.name) LIKE $1 OR LOWER(c.name) LIKE $1
         ORDER BY p.name LIMIT 10`,
        [term]
      ),
      pool.query(
        `SELECT o.id, o.total, o.status, o.created_at,
                u.name as user_name
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE LOWER(o.id::text) LIKE $1 OR LOWER(u.name) LIKE $1
         ORDER BY o.created_at DESC LIMIT 10`,
        [term]
      ),
      pool.query(
        `SELECT id, name, email, phone, role, created_at
         FROM users
         WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(phone) LIKE $1
         ORDER BY name LIMIT 10`,
        [term]
      ),
    ]);

    res.json({
      products: products.rows,
      orders: orders.rows,
      users: users.rows,
    });
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ error: 'Error en la busqueda' });
  }
});

// Dashboard metrics
app.get('/api/dashboard/metrics', authenticate, async (req, res) => {
  try {
    console.log('[Dashboard] Fetching metrics for user:', req.user?.id);
    
    const [products, orders, users, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count FROM products'),
      pool.query('SELECT COUNT(*)::int as count FROM orders'),
      pool.query('SELECT COUNT(*)::int as count FROM users'),
      pool.query("SELECT COALESCE(SUM(total), 0)::numeric as total FROM orders WHERE status != 'CANCELLED'"),
    ]);

    const lowStock = await pool.query(
      `SELECT p.id, p.name, COALESCE(SUM(i.stock), 0) as stock
       FROM products p LEFT JOIN inventory i ON p.id = i.product_id
       GROUP BY p.id, p.name HAVING COALESCE(SUM(i.stock), 0) < 5 ORDER BY stock ASC LIMIT 5`
    );

    const result = {
      products: products.rows[0]?.count || 0,
      orders: orders.rows[0]?.count || 0,
      users: users.rows[0]?.count || 0,
      revenue: Number(revenue.rows[0]?.total || 0),
      lowStock: lowStock.rows || [],
    };
    
    console.log('[Dashboard] Metrics fetched successfully:', result);
    console.log('[Dashboard] Sending response with status:', res.statusCode);
    res.json(result);
    console.log('[Dashboard] Response sent');
  } catch (error) {
    console.error('[Dashboard] Error fetching metrics:', error);
    console.error('[Dashboard] Error stack:', error.stack);
    res.status(500).json({ error: 'Error al obtener metricas', details: error.message, stack: error.stack });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      timestamp: new Date().toISOString() 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 VoltaAPI running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: PostgreSQL`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

export default app;
