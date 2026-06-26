const requests = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

export function rateLimit({ windowMs = 60000, max = 100, message = 'Demasiadas peticiones, intenta de nuevo mas tarde' } = {}) {
  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(ip)) {
      requests.set(ip, []);
    }

    const timestamps = requests.get(ip).filter((t) => t > windowStart);
    requests.set(ip, timestamps);

    if (timestamps.length >= max) {
      return res.status(429).json({ error: message });
    }

    timestamps.push(now);
    next();
  };
}

export function strictRateLimit() {
  return rateLimit({ windowMs: 60000, max: 30, message: 'Demasiados intentos de autenticacion' });
}
