import jwt from 'jsonwebtoken';
import config from '../config.js';

const ALGORITHM = 'HS256';

export function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: 'access' }, config.jwtSecret, { algorithm: ALGORITHM, expiresIn: '15m' });
}

export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { algorithm: ALGORITHM, expiresIn: '7d' });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return payload;
}
