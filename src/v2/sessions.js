import crypto from 'node:crypto';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map();

export function createSession(state) {
  const id = crypto.randomUUID();
  sessions.set(id, { state, lastSeen: Date.now() });
  return id;
}

export function getSession(id) {
  const session = typeof id === 'string' ? sessions.get(id) : undefined;
  if (session) session.lastSeen = Date.now();
  return session;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.lastSeen < cutoff) sessions.delete(id);
}, 10 * 60 * 1000).unref();

// Sliding-window rate limiter, keyed by client IP.
const hits = new Map();

export function rateLimited(key, limit = 40, windowMs = 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}
