import express from 'express';
import cors from 'cors';
import { connectDB } from './lib/db.js';
import { errorHandler, notFound } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import decisionRoutes from './routes/decisions.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true, credentials: false }));
  app.use(express.json({ limit: '64kb' }));

  // Netlify rewrites /api/* to /.netlify/functions/api/*; normalise both shapes.
  app.use((req, _res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      req.url = req.url.replace('/.netlify/functions/api', '/api') || '/api';
    }
    next();
  });

  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'tiebreak', time: new Date().toISOString() }));

  // Every API route needs the database. Connect lazily (cached across warm invocations).
  app.use('/api', async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/decisions', decisionRoutes);

  app.use('/api', (_req, _res, next) => next(notFound('That endpoint does not exist.')));
  app.use(errorHandler);
  return app;
}
