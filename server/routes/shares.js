import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { checkPortfolioAccess, requireRole } from '../middleware/permissions.js';
import { handleRoute } from '../utils/handleRoute.js';

const router = Router({ mergeParams: true });

// All routes require auth + portfolio access
router.use(authenticate);
router.use(checkPortfolioAccess);

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase()),
  role: z.enum(['viewer', 'editor']),
});

const updateRoleSchema = z.object({
  role: z.enum(['viewer', 'editor']),
});

// GET /api/portfolios/:id/shares -- list shares (owner only)
router.get('/', requireRole('owner'), handleRoute('List shares', (req, res) => {
  const shares = db.prepare(
    `SELECT ps.id, ps.user_id, u.email, u.display_name, ps.role, ps.created_at
     FROM portfolio_shares ps
     JOIN users u ON ps.user_id = u.id
     WHERE ps.portfolio_id = ?`
  ).all(req.params.id);

  res.json({ shares });
}));

// POST /api/portfolios/:id/shares -- invite user (owner only)
router.post('/', requireRole('owner'), handleRoute('Invite', (req, res) => {
  const { email, role } = inviteSchema.parse(req.body);

  const user = db.prepare('SELECT id, email, display_name FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'No user found with that email address' });
  }

  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot share with yourself' });
  }

  const existing = db.prepare(
    'SELECT id FROM portfolio_shares WHERE portfolio_id = ? AND user_id = ?'
  ).get(req.params.id, user.id);

  if (existing) {
    return res.status(409).json({ error: 'User already has access to this portfolio' });
  }

  db.prepare(
    'INSERT INTO portfolio_shares (portfolio_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, user.id, role, req.user.id);

  res.status(201).json({
    share: { userId: user.id, email: user.email, displayName: user.display_name, role },
  });
}));

function validateUserId(req, res, next) {
  if (!req.params.userId || !/^\d+$/.test(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  next();
}

// PUT /api/portfolios/:id/shares/:userId -- update role (owner only)
router.put('/:userId', validateUserId, requireRole('owner'), handleRoute('Update role', (req, res) => {
  const { role } = updateRoleSchema.parse(req.body);

  const result = db.prepare(
    'UPDATE portfolio_shares SET role = ? WHERE portfolio_id = ? AND user_id = ?'
  ).run(role, req.params.id, req.params.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Share not found' });
  }

  res.json({ message: 'Role updated' });
}));

// DELETE /api/portfolios/:id/shares/:userId -- revoke access (owner only)
router.delete('/:userId', validateUserId, requireRole('owner'), handleRoute('Revoke access', (req, res) => {
  const result = db.prepare(
    'DELETE FROM portfolio_shares WHERE portfolio_id = ? AND user_id = ?'
  ).run(req.params.id, req.params.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Share not found' });
  }

  res.json({ message: 'Access revoked' });
}));

export default router;
