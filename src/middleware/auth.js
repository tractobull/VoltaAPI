import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'volta-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  console.log('[Auth] Checking authentication for:', req.path);
  console.log('[Auth] Auth header present:', !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth] No valid auth header found');
    return res.status(401).json({ error: 'Token de autenticacion requerido' });
  }

  const token = authHeader.split(' ')[1];
  console.log('[Auth] Token length:', token?.length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[Auth] Token verified for user:', decoded.id);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.name, error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token invalido' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta accion' });
    }

    next();
  };
}
