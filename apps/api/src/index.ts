import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { config } from './config.js';
import { pool } from './services/database.js';

import authRouter     from './routes/auth.js';
import vmRouter       from './routes/vms.js';
import consoleRouter, { attachVNCProxy } from './routes/console.js';
import customerRouter from './routes/customer.js';
import invoicesRouter from './routes/invoices.js';
import { initSocketServer } from './websocket/index.js';

const app    = express();
const server = http.createServer(app);

// ── Global middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:      config.frontendUrl,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(compression() as any);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// ── Health check (used by docker-compose healthcheck) ────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/auth',    authRouter);
app.use('/vms',     vmRouter);
app.use('/console', consoleRouter);
app.use('/customer', customerRouter);
app.use('/invoices', invoicesRouter);

// ── 404 catch-all ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ── Error handler ────────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ── WebSocket (Socket.io + noVNC proxy) ──────────────────────────────────
const io = initSocketServer(server);
attachVNCProxy(server);

// ── Start ─────────────────────────────────────────────────────────────────
async function start() {
  // Verify DB connection
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    process.exit(1);
  }

  server.listen(config.port, () => {
  });
}

start();

// ── Graceful shutdown ─────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  await pool.end();
  server.close(() => process.exit(0));
});
