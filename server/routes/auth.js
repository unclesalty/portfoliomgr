import { Router } from 'express';
import { createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { handleRoute } from '../utils/handleRoute.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';

const router = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().max(255).transform(e => e.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
  password: z.string().min(1),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// Cookie options
const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

const ACCESS_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: 15 * 60 * 1000, path: '/' };
const REFRESH_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: SEVEN_DAYS_MS, path: '/api/auth/refresh' };

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Signs access + refresh tokens, stores the refresh session, and sets both cookies.
 */
function issueTokens(res, userId) {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId });

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, hashToken(refreshToken), expiresAt);

  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
}

// POST /api/auth/register
router.post('/register', authLimiter, handleRoute('Register', async (req, res) => {
  const { email, password, displayName } = registerSchema.parse(req.body);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
  ).run(email, passwordHash, displayName || null);

  const userId = Number(result.lastInsertRowid);
  issueTokens(res, userId);

  res.status(201).json({
    user: { id: userId, email, displayName: displayName || null },
  });
}));

// POST /api/auth/login
router.post('/login', authLimiter, handleRoute('Login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  issueTokens(res, user.id);

  res.json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
}));

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash = ?')
      .run(req.user.id, hashToken(refreshToken));
  }

  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logged out' });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const session = db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? AND token_hash = ? AND expires_at > datetime(\'now\')'
    ).get(payload.userId, tokenHash);

    if (!session) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Verify user still exists
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.userId);
    if (!user) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(payload.userId);
      return res.status(401).json({ error: 'User no longer exists' });
    }

    // Rotate: delete old, issue new
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    issueTokens(res, payload.userId);

    res.json({ message: 'Token refreshed' });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/password
router.put('/password', authenticate, handleRoute('Password change', async (req, res) => {
  const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await comparePassword(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newHash, req.user.id);

  // Invalidate all sessions
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);

  res.json({ message: 'Password updated' });
}));

export default router;
