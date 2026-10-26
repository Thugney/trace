import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import cron from 'node-cron';
import { gzipSync } from 'node:zlib';
import http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.useRealTimers());

describe('patched HTTP dependencies preserve request boundaries', () => {
  async function rawGzipPost(app: express.Express, body: Buffer) {
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const outgoing = http.request({
          host: '127.0.0.1', port: (server.address() as AddressInfo).port,
          method: 'POST', path: '/api/profiles/login',
          headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': body.length },
        }, (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.once('error', reject);
          response.once('end', () => resolve({ status: response.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        outgoing.once('error', reject);
        outgoing.end(body);
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }

  function jsonApp() {
    const app = express();
    app.use(compression());
    app.use(express.json());
    app.post('/api/profiles/login', (req, res) => res.json({ username: req.body.username }));
    app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(error.status || 500).json({ error: 'invalid body' });
    });
    return app;
  }

  it('accepts valid gzip JSON and rejects trailing compressed-body bytes without breaking the next request', async () => {
    const app = jsonApp();
    const gzip = gzipSync(JSON.stringify({ username: 'synthetic-parent' }));
    // Superagent JSON-serializes Buffer values for this content type; use raw
    // HTTP bytes so these assertions exercise the compressed-body parser.
    const send = (body: Buffer) => rawGzipPost(app, body);
    expect((await send(gzip)).body).toEqual({ username: 'synthetic-parent' });
    expect((await send(Buffer.concat([gzip, Buffer.from('trailing-data')]))).status).toBe(400);
    expect((await send(gzip)).status).toBe(200);
  });

  it('enforces the decoded JSON body limit for a small compressed request', async () => {
    const body = gzipSync(JSON.stringify({ username: 'x'.repeat(120 * 1024) }));
    const result = await rawGzipPost(jsonApp(), body);
    expect(result.status).toBe(413);
  });

  it('keeps the one-hop client address stable when an untrusted leftmost forwarding value changes', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimit({ windowMs: 60_000, limit: 1, standardHeaders: true, legacyHeaders: false }));
    app.get('/login-boundary', (req, res) => res.json({ ip: req.ip }));
    const first = await request(app).get('/login-boundary').set('X-Forwarded-For', '198.51.100.1, 203.0.113.10');
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe('203.0.113.10');
    const second = await request(app).get('/login-boundary').set('X-Forwarded-For', '198.51.100.2, 203.0.113.10');
    expect(second.status).toBe(429);
    expect((await request(app).get('/login-boundary').set('X-Forwarded-For', '203.0.113.11')).status).toBe(200);
  });

  it('preserves gzip response content through the patched compression middleware', async () => {
    const app = express();
    app.use(compression());
    const content = 'synthetic response '.repeat(300);
    app.get('/response', (_req, res) => res.type('text').send(content));
    const result = await request(app).get('/response').set('Accept-Encoding', 'gzip');
    expect(result.headers['content-encoding']).toBe('gzip');
    expect(result.text).toBe(content);
  });
});

describe('node-cron migration preserves the scheduler API used by the app', () => {
  it('starts a scheduled callback on the next matching minute, without an immediate run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    const run = vi.fn(async () => undefined);
    const task = cron.schedule('* * * * *', run);
    try {
      expect(run).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60_010);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      await task.destroy();
    }
  });
});
