import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { unauthorized } from '../lib/errors.js';

const TOKEN_TTL = '7d';

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign({ sub: user._id.toString() }, secret, { expiresIn: TOKEN_TTL });
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized('This account no longer exists.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
