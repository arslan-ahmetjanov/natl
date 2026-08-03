#!/usr/bin/env node
/**
 * Tiny local echo API for NATL examples / course (httpbin-like).
 * Usage: node stubs/echo-server.mjs
 * Env: PORT (default 8765)
 */
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8765);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  let jsonBody = null;
  if (raw) {
    try {
      jsonBody = JSON.parse(raw);
    } catch {
      jsonBody = raw;
    }
  }

  const path = url.pathname;
  if (path === '/get' || path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path, method: req.method }));
    return;
  }
  if (path === '/post' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, json: jsonBody, path }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found', path }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`NATL echo stub http://127.0.0.1:${port}`);
});
