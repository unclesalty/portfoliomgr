import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists (recursive mkdir is a no-op if it already exists)
mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Clean up expired sessions on startup and periodically (every hour)
const cleanExpiredSessions = () => {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
};
cleanExpiredSessions();
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

export default db;
