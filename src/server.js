import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatV1, resetV1 } from './v1/game.js';
import { startGame, nextLevel, retryLevel, playTurn, takeHint, GameError } from './v2/game.js';
import { geminiConfigured, geminiModel } from './v2/gemini.js';
import { rateLimited } from './v2/sessions.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file - rely on real environment variables.
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 4 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY_BYTES) throw new GameError('Request body too large.', 413);
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new GameError('Invalid JSON body.', 400);
  }
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

const routes = {
  'GET /api/health': async () => ({ ok: true, ai: { enabled: geminiConfigured(), model: geminiModel() } }),

  // Version 1 - kept unchanged for comparison.
  'POST /api/v1/chat': async (body) => chatV1(body.sessionId, body.message),
  'POST /api/v1/reset': async (body) => (resetV1(body.sessionId), { ok: true }),

  // Version 2
  'POST /api/v2/new': async (body) => startGame({ mode: body.mode === 'ai' ? 'ai' : 'classic' }),
  'POST /api/v2/next': async (body) => nextLevel(body.sessionId, { classic: body.classic === true }),
  'POST /api/v2/retry': async (body) => retryLevel(body.sessionId),
  'POST /api/v2/action': async (body) => playTurn(body.sessionId, body.input),
  'POST /api/v2/hint': async (body) => takeHint(body.sessionId),
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${pathname}`];

  if (!handler) {
    if (req.method === 'GET') return serveStatic(req, res);
    return sendJson(res, 404, { error: 'Not found' });
  }

  const ip = req.socket.remoteAddress || 'unknown';
  if (pathname.startsWith('/api/v2') && rateLimited(ip)) {
    return sendJson(res, 429, { error: 'Too many requests - slow down a little.' });
  }
  if (['/api/v2/new', '/api/v2/next', '/api/v2/retry'].includes(pathname) && rateLimited(`new:${ip}`, 12)) {
    return sendJson(res, 429, { error: 'Too many new games in a minute - give ECHO a moment.' });
  }

  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    sendJson(res, 200, await handler(body));
  } catch (err) {
    const status = err instanceof GameError ? err.status : 500;
    if (status === 500) console.error(`[${pathname}]`, err);
    sendJson(res, status, { error: status === 500 ? 'Something went wrong on the server.' : err.message });
  }
});

server.listen(PORT, () => {
  console.log(`AI Escape Room running at http://localhost:${PORT}`);
  console.log(geminiConfigured() ? `Gemini enabled (${geminiModel()})` : 'GEMINI_API_KEY not set - V2 runs with the offline narrator, V1 will not work.');
});
