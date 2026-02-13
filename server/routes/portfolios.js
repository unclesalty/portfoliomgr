import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { checkPortfolioAccess, requireRole } from '../middleware/permissions.js';
import { handleRoute } from '../utils/handleRoute.js';

const router = Router();

// All portfolio routes require authentication
router.use(authenticate);

// Validation schemas
const createPortfolioSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().max(200).optional(),
  data: z.object({
    projects: z.array(z.any()).default([]),
    valueStreams: z.array(z.any()).default([]),
    resourceTypes: z.array(z.any()).default([]),
    rocks: z.array(z.any()).default([]),
    contractHours: z.number().default(0),
    settings: z.record(z.any()).default({}),
  }).default({}),
});

const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientName: z.string().max(200).optional(),
  data: z.object({
    projects: z.array(z.any()).optional(),
    valueStreams: z.array(z.any()).optional(),
    resourceTypes: z.array(z.any()).optional(),
    rocks: z.array(z.any()).optional(),
    contractHours: z.number().optional(),
    settings: z.record(z.any()).optional(),
  }).optional(),
});

function parseJsonSafe(raw) {
  try { return JSON.parse(raw); } catch { return {}; }
}

// GET /api/portfolios -- list owned + shared portfolios
router.get('/', handleRoute('List portfolios', (req, res) => {
  const owned = db.prepare(
    `SELECT id, name, client_name AS clientName, created_at AS createdAt, updated_at AS updatedAt, 'owner' as role
     FROM portfolios WHERE owner_id = ?`
  ).all(req.user.id);

  const shared = db.prepare(
    `SELECT p.id, p.name, p.client_name AS clientName, p.created_at AS createdAt, p.updated_at AS updatedAt, ps.role
     FROM portfolios p
     JOIN portfolio_shares ps ON p.id = ps.portfolio_id
     WHERE ps.user_id = ?`
  ).all(req.user.id);

  res.json({ portfolios: [...owned, ...shared] });
}));

// POST /api/portfolios -- create new portfolio
router.post('/', handleRoute('Create portfolio', (req, res) => {
  const { name, clientName, data } = createPortfolioSchema.parse(req.body);

  const result = db.prepare(
    'INSERT INTO portfolios (owner_id, name, client_name, data) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, name, clientName || null, JSON.stringify(data));

  res.status(201).json({
    portfolio: {
      id: Number(result.lastInsertRowid),
      name,
      clientName: clientName || null,
      role: 'owner',
    },
  });
}));

// GET /api/portfolios/:id -- get portfolio data
router.get('/:id', checkPortfolioAccess, (req, res) => {
  const { portfolio } = req;
  const data = parseJsonSafe(portfolio.data);

  res.json({
    portfolio: {
      id: portfolio.id,
      name: portfolio.name,
      clientName: portfolio.client_name,
      data,
      role: req.accessRole,
      createdAt: portfolio.created_at,
      updatedAt: portfolio.updated_at,
    },
  });
});

// PUT /api/portfolios/:id -- update portfolio
router.put('/:id', checkPortfolioAccess, requireRole('owner', 'editor'), handleRoute('Update portfolio', (req, res) => {
  const updates = updatePortfolioSchema.parse(req.body);

  const sets = [];
  const values = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.clientName !== undefined) {
    sets.push('client_name = ?');
    values.push(updates.clientName);
  }
  if (updates.data !== undefined) {
    const existingData = parseJsonSafe(req.portfolio.data);
    sets.push('data = ?');
    values.push(JSON.stringify({ ...existingData, ...updates.data }));
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.prepare(`UPDATE portfolios SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json({ message: 'Portfolio updated' });
}));

// DELETE /api/portfolios/:id -- delete portfolio (owner only)
router.delete('/:id', checkPortfolioAccess, requireRole('owner'), handleRoute('Delete portfolio', (req, res) => {
  db.prepare('DELETE FROM portfolios WHERE id = ?').run(req.params.id);
  res.json({ message: 'Portfolio deleted' });
}));

export default router;
