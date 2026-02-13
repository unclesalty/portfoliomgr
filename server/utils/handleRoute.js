import { z } from 'zod';

/**
 * Wraps a route handler with Zod validation error handling and generic error logging.
 * Catches ZodErrors and returns 400; catches everything else and returns 500.
 */
export function handleRoute(label, handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors });
      }
      console.error(`${label} error:`, err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
