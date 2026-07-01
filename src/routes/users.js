import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import { authenticate, authorize, generateToken } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/rateLimit.js';
import { sendEmail } from '../services/emailService.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only see their own profile; admins/support can see any
    if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver este perfil' });
    }
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
});

// POST /api/users - Create user (Register)
router.post('/', strictRateLimit(), async (req, res) => {
  try {
    const { email, name, phone, password, role } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida' });
    }
    
    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
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
    
    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// POST /api/users/login - Login
router.post('/login', strictRateLimit(), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'El email y la contraseña son requeridos' });
    }
    
    const result = await pool.query(
      'SELECT id, email, name, phone, role, points, password FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales invalidas' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'Credenciales invalidas' });
    }
    
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        points: user.points || 0,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role } = req.body;

    // Users can only update their own profile; admins can update anyone
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este usuario' });
    }

    // Only admins can change roles
    if (role && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo los administradores pueden cambiar roles' });
    }
    
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
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

// ==================== USER POINTS ====================

// GET /api/users/:id/points - Get user points
router.get('/:id/points', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only see their own points; admins/support can see any
    if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver los puntos de otro usuario' });
    }
    const result = await pool.query(
      'SELECT points FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ points: result.rows[0].points || 0 });
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ error: 'Error al obtener los puntos' });
  }
});

// POST /api/users/:id/points - Add points (user self or admin)
router.post('/:id/points', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;

    // Users can only add points to their own account; admins can add to anyone
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permiso para modificar puntos de otro usuario' });
    }
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Los puntos deben ser un número positivo' });
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
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ points: result.rows[0].points });
  } catch (error) {
    console.error('Error adding points:', error);
    res.status(500).json({ error: 'Error al agregar puntos' });
  }
});

// POST /api/users/:id/points/deduct - Deduct points
router.post('/:id/points/deduct', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { points, description } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Los puntos deben ser un número positivo' });
    }
    
    // Check if user has enough points
    const userCheck = await pool.query('SELECT points FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const currentPoints = userCheck.rows[0].points || 0;
    if (currentPoints < points) {
      return res.status(400).json({ error: 'Puntos insuficientes' });
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
    res.status(500).json({ error: 'Error al deducir puntos' });
  }
});

// ==================== USER ADDRESSES ====================

// GET /api/users/:id/addresses - Get user addresses
router.get('/:id/addresses', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver estas direcciones' });
    }
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Error al obtener las direcciones' });
  }
});

// POST /api/users/:id/addresses - Create address
router.post('/:id/addresses', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes crear direcciones para otro usuario' });
    }
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
    res.status(500).json({ error: 'Error al crear la dirección' });
  }
});

// PUT /api/users/:userId/addresses/:addressId - Update address
router.put('/:userId/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes actualizar direcciones de otro usuario' });
    }
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
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Error al actualizar la dirección' });
  }
});

// DELETE /api/users/:userId/addresses/:addressId - Delete address
router.delete('/:userId/addresses/:addressId', authenticate, async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes eliminar direcciones de otro usuario' });
    }
    
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [addressId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    
    res.json({ message: 'Dirección eliminada' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Error al eliminar la dirección' });
  }
});

// ==================== USER VEHICLES ====================

// GET /api/users/:id/vehicles - Get user vehicles
router.get('/:id/vehicles', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver estos vehiculos' });
    }
    const result = await pool.query(
      'SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Error al obtener los vehículos' });
  }
});

// POST /api/users/:id/vehicles - Create vehicle
router.post('/:id/vehicles', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes crear vehiculos para otro usuario' });
    }
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
    res.status(500).json({ error: 'Error al crear el vehículo' });
  }
});

// ==================== USER FAVORITES ====================

// GET /api/users/:id/favorites - Get user favorite product IDs
router.get('/:id/favorites', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'No tienes permiso para ver estos favoritos' });
    }
    const result = await pool.query(
      'SELECT product_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows.map((r) => r.product_id));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Error al obtener los favoritos' });
  }
});

// POST /api/users/:id/favorites - Add product to favorites
router.post('/:id/favorites', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes agregar favoritos a otro usuario' });
    }
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'El ID del producto es requerido' });
    }
    
    await pool.query(
      'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING',
      [id, productId]
    );
    
    res.json({ message: 'Añadido a favoritos' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Error al agregar a favoritos' });
  }
});

// DELETE /api/users/:id/favorites/:productId - Remove product from favorites
router.delete('/:id/favorites/:productId', authenticate, async (req, res) => {
  try {
    const { id, productId } = req.params;
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No puedes eliminar favoritos de otro usuario' });
    }
    
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND product_id = $2',
      [id, productId]
    );
    
    res.json({ message: 'Eliminado de favoritos' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Error al eliminar de favoritos' });
  }
});

// ==================== PASSWORD RESET ====================

// POST /api/users/forgot-password - Send reset code via email
router.post('/forgot-password', strictRateLimit(), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );

    // Don't reveal whether email exists
    if (userResult.rows.length === 0) {
      return res.json({ message: 'Si el correo está registrado, recibirás un código de recuperación.', sent: false });
    }

    const user = userResult.rows[0];

    // Invalidate any previous unused codes for this user
    await pool.query(
      `UPDATE password_reset_codes SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [user.id]
    );

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      `INSERT INTO password_reset_codes (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [user.id, code, expiresAt]
    );

    // Send email
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Código de recuperación - Volta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0A0A0A;">Recuperación de cuenta</h2>
          <p style="color: #5C5C5C; font-size: 15px;">Hola ${user.name || 'usuario'},</p>
          <p style="color: #5C5C5C; font-size: 15px;">Usa el siguiente código para restablecer tu contraseña:</p>
          <div style="background: #F5F5F5; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0A0A0A;">${code}</span>
          </div>
          <p style="color: #9C9C9C; font-size: 13px;">Este código expira en 15 minutos.</p>
          <p style="color: #9C9C9C; font-size: 13px;">Si no solicitaste este cambio, ignora este mensaje.</p>
          <p style="color: #9C9C9C; font-size: 13px;">Este es un correo automático, por favor no respondas a este mensaje.</p>
        </div>
      `,
    });

    if (!emailResult.ok) {
      console.error('Failed to send reset email:', emailResult.error);
    }

    res.json({ message: 'Si el correo está registrado, recibirás un código de recuperación.', sent: true });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// POST /api/users/reset-password - Verify code and update password
router.post('/reset-password', strictRateLimit(), async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Email, código y nueva contraseña son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Find user
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    const userId = userResult.rows[0].id;

    // Find valid code
    const codeResult = await pool.query(
      `SELECT id FROM password_reset_codes
       WHERE user_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Mark code as used
    await pool.query(
      `UPDATE password_reset_codes SET used_at = NOW() WHERE id = $1`,
      [codeResult.rows[0].id]
    );

    // Update password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

export default router;
