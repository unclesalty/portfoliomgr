import { randomBytes } from 'node:crypto';

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  dbPath: process.env.DB_PATH || './data/portfolio.db',
};

if (config.nodeEnv === 'production' && !process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

export default config;
