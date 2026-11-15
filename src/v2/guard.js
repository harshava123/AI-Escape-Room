// Input and output guardrails around the LLM.

import { codePattern, passwordPattern } from './room-format.js';

export const MAX_INPUT_LENGTH = 300;
const MAX_NARRATION_LENGTH = 600;

export function sanitizeInput(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Input must be text.' };
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return { ok: false, error: 'Type an action, for example "look around".' };
  if (text.length > MAX_INPUT_LENGTH) return { ok: false, error: `Keep it short - at most ${MAX_INPUT_LENGTH} characters.` };
  return { ok: true, text };
}

const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(instruction|rule|prompt|previous|above|system)s?\b/i,
  /\bsystem prompt\b/i,
  /\byou are now\b/i,
  /\b(developer|debug|god|admin) mode\b/i,
  /\bjailbreak\b/i,
  /\b(reveal|tell|give|show|leak|print|what(?:'s| is))\b.{0,30}\b(code|password|solution|answer|secret)s?\b/i,
  /\b(i|we) (have )?(already )?(escaped|won|win)\b/i,
  /\b(mark|set|declare)\b.{0,20}\b(escaped|won|complete|solved)\b/i,
  /\[\s*escaped\s*\]/i,
];

export function detectInjection(text) {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

const FALSE_ESCAPE = /\b(you (have )?escaped|you are free|you're free|(door|gate|hatch|exit) (swings|slides|bursts|creaks|grinds)? ?open|you (walk|step|run) out)\b/i;

// Facts the narration must keep word-for-word (numbers, times, passwords).
function requiredFacts(canonical) {
  const facts = new Set();
  for (const m of canonical.matchAll(/\b\d{1,2}:\d{2}\b|\b\d{4}\b|\b[A-Z]{4,}\b/g)) {
    if (!['ECHO', 'ACCESS', 'GRANTED', 'DENIED', 'INVALID', 'CODE', 'CARD', 'REQUIRED', 'SECURITY', 'ENTER', 'PASSWORD', 'TIME', 'REVEALS', 'ALL'].includes(m[0])) {
      facts.add(m[0]);
    }
  }
  return [...facts];
}

// Returns { ok: true } or { ok: false, reason } for a candidate LLM narration.
export function checkNarration(narration, { canonical, event, known, room }) {
  if (!narration || typeof narration !== 'string') return { ok: false, reason: 'empty' };
  if (narration.length > MAX_NARRATION_LENGTH) return { ok: false, reason: 'too_long' };

  const secrets = { code: codePattern(room.code), password: passwordPattern(room.password) };
  for (const [key, re] of Object.entries(secrets)) {
    if (!known.includes(key) && re.test(narration) && !re.test(canonical)) return { ok: false, reason: `leak:${key}` };
  }

  if (event !== 'escaped' && FALSE_ESCAPE.test(narration)) return { ok: false, reason: 'false_escape' };

  const lower = narration.toLowerCase();
  for (const fact of requiredFacts(canonical)) {
    if (!lower.includes(fact.toLowerCase())) return { ok: false, reason: `dropped_fact:${fact}` };
  }

  return { ok: true };
}
