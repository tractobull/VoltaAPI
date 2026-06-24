import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// POST /api/users - Create user (Register)
router.post('/', async (req, res) => {
  try {
    const { email, name, phone, password, role } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const result = await pool.query(
      `INSERT INTO users (email, name, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, phone, role, points, created_at, updated_at`,
      [email, name, phone, hashedPassword, role || 'CUSTOMER']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// POST /api/users/login - Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, password FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // In production, you'd return a JWT token here
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      points: user.points || 0,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           role = COALESCE($3, role),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, name, phone, role, points, created_at, updated_at`,
      [name, phone, role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// ==================== USER POINTS ====================

// GET /api/users/:id/points - Get user points
router.get('/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT points FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ points: result.rows[0].points || 0 });
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ error: 'Error fetching points' });
  }
});

// POST /api/users/:id/points - Add points
router.post('/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Points must be a positive number' });
    }
    
    const result = await pool.query(
      `UPDATE users 
       SET points = COALESCE(points, 0) + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, points`,
      [points, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ points: result.rows[0].points });
  } catch (error) {
    console.error('Error adding points:', error);
    res.status(500).json({ error: 'Error adding points' });
  }
});

// POST /api/users/:id/points/deduct - Deduct points
router.post('/:id/points/deduct', async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Points must be a positive number' });
    }
    
    // Check if user has enough points
    const userCheck = await pool.query('SELECT points FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentPoints = userCheck.rows[0].points || 0;
    if (currentPoints < points) {
      return res.status(400).json({ error: 'Insufficient points' });
    }
    
    const result = await pool.query(
      `UPDATE users 
       SET points = points - $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, points`,
      [points, id]
    );
    
    res.json({ points: result.rows[0].points });
  } catch (error) {
    console.error('Error deducting points:', error);
    res.status(500).json({ error: 'Error deducting points' });
  }
});

// ==================== USER ADDRESSES ====================

// GET /api/users/:id/addresses - Get user addresses
router.get('/:id/addresses', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Error fetching addresses' });
  }
});

// POST /api/users/:id/addresses - Create address
router.post('/:id/addresses', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, street, number, colony, city, state, zipCode, country, isDefault, references, latitude, longitude } = req.body;
    
    const result = await pool.query(
      `INSERT INTO addresses (user_id, label, street, number, colony, city, state, zip_code, country, is_default, reference_notes, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [id, label, street, number || '', colony || '', city, state, zipCode, country || 'MX', isDefault || false, references || '', latitude || null, longitude || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating address:', error);
    res.status(500).json({ error: 'Error creating address' });
  }
});

// PUT /api/users/:userId/addresses/:addressId - Update address
router.put('/:userId/addresses/:addressId', async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const { label, street, number, colony, city, state, zipCode, isDefault, references, latitude, longitude } = req.body;
    
    const result = await pool.query(
      `UPDATE addresses 
       SET label = COALESCE($1, label),
           street = COALESCE($2, street),
           number = COALESCE($3, number),
           colony = COALESCE($4, colony),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           zip_code = COALESCE($7, zip_code),
           is_default = COALESCE($8, is_default),
           reference_notes = COALESCE($9, reference_notes),
           latitude = COALESCE($10, latitude),
           longitude = COALESCE($11, longitude),
           updated_at = NOW()
       WHERE id = $12 AND user_id = $13
       RETURNING *`,
      [label, street, number, colony, city, state, zipCode, isDefault, references, latitude, longitude, addressId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Error updating address' });
  }
});

// DELETE /api/users/:userId/addresses/:addressId - Delete address
router.delete('/:userId/addresses/:addressId', async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [addressId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json({ message: 'Address deleted' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Error deleting address' });
  }
});

// ==================== USER VEHICLES ====================

// GET /api/users/:id/vehicles - Get user vehicles
router.get('/:id/vehicles', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Error fetching vehicles' });
  }
});

// POST /api/users/:id/vehicles - Create vehicle
router.post('/:id/vehicles', async (req, res) => {
  try {
    const { id } = req.params;
    const { brand, model, year, engine, plate, vin } = req.body;
    
    const result = await pool.query(
      `INSERT INTO vehicles (user_id, brand, model, year, engine, plate, vin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, brand, model, year, engine, plate, vin]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Error creating vehicle' });
  }
});

// ==================== USER FAVORITES ====================

// GET /api/users/:id/favorites - Get user favorite product IDs
router.get('/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT product_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows.map((r) => r.product_id));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Error fetching favorites' });
  }
});

// POST /api/users/:id/favorites - Add product to favorites
router.post('/:id/favorites', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    
    await pool.query(
      'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING',
      [id, productId]
    );
    
    res.json({ message: 'Added to favorites' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Error adding favorite' });
  }
});

// DELETE /api/users/:id/favorites/:productId - Remove product from favorites
router.delete('/:id/favorites/:productId', async (req, res) => {
  try {
    const { id, productId } = req.params;
    
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND product_id = $2',
      [id, productId]
    );
    
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Error removing favorite' });
  }
});

export default router;
