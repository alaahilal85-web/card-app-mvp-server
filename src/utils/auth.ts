import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { Request, Response, NextFunction } from 'express';

export function signJwt(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
