import db from '../db/index.js';

export function checkPortfolioAccess(req, res, next) {
  const { id } = req.params;
  const userId = req.user.id;

  // Validate portfolio ID is a positive integer
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid portfolio ID' });
  }

  // Single query: fetch portfolio and determine access role via LEFT JOIN
  const row = db.prepare(
    `SELECT p.*, ps.role AS share_role
     FROM portfolios p
     LEFT JOIN portfolio_shares ps ON p.id = ps.portfolio_id AND ps.user_id = ?
     WHERE p.id = ?`
  ).get(userId, id);

  if (!row) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (row.owner_id === userId) {
    req.portfolio = row;
    req.accessRole = 'owner';
    return next();
  }

  if (row.share_role) {
    req.portfolio = row;
    req.accessRole = row.share_role;
    return next();
  }

  return res.status(403).json({ error: 'Access denied' });
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (allowedRoles.includes(req.accessRole)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}
