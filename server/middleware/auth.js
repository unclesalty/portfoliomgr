import { verifyAccessToken } from '../utils/jwt.js';
import db from '../db/index.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyAccessToken(token);
    const row = db.prepare('SELECT id, email, display_name FROM users WHERE id = ?').get(payload.userId);
    if (!row) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = { id: row.id, email: row.email, displayName: row.display_name };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
