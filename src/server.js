import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatV1, resetV1 } from './v1/game.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file - rely on real environment variables.
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
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

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');

  if (req.method === 'POST' && pathname === '/api/v1/chat') {
    const { sessionId, message } = await readJson(req);
    const result = await chatV1(sessionId, message);
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && pathname === '/api/v1/reset') {
    const { sessionId } = await readJson(req);
    resetV1(sessionId);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET') return serveStatic(req, res);

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`AI Escape Room running at http://localhost:${PORT}`);
});
