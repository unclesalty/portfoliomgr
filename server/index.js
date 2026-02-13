import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolios.js';
import shareRoutes from './routes/shares.js';

// Initialize database (runs schema on import)
import './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.nodeEnv === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));

// General rate limiting for all API routes
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/portfolios/:id/shares', shareRoutes);

// Serve static frontend files in production
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for all non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(join(distPath, 'index.html'));
  }
  next();
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port} (${config.nodeEnv})`);
});
