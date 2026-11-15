// Fast, free, deterministic parser for common commands.
// Returns a structured action, or null when the input is too ambiguous -
// in which case the orchestrator falls back to Gemini for understanding.

import { OBJECTS, ITEMS } from './room.js';

function buildIndex(defs) {
  const entries = [];
  for (const [id, def] of Object.entries(defs)) {
    for (const alias of def.aliases) entries.push({ id, alias });
  }
  return entries.sort((a, b) => b.alias.length - a.alias.length);
}

const OBJECT_INDEX = buildIndex(OBJECTS);
const ITEM_INDEX = buildIndex(ITEMS);
const ALL_INDEX = [...OBJECT_INDEX.map((e) => ({ ...e, kind: 'object' })), ...ITEM_INDEX.map((e) => ({ ...e, kind: 'item' }))].sort(
  (a, b) => b.alias.length - a.alias.length,
);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findEntity(text, index) {
  for (const { id, alias, kind } of index) {
    if (new RegExp(`\\b${escapeRe(alias)}\\b`).test(text)) return { id, kind };
  }
  return null;
}

export function normalize(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9:\s'-]/g, ' ')
    .replace(/\b(the|a|an|my|that|this|please|carefully|closely)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const action = (intent, extra = {}) => ({ intent, target: 'none', item: 'none', code: '', ...extra });

export function parseLocal(input) {
  const text = normalize(input);
  if (!text) return null;

  if (/^(i|inv|inventory|bag|items|pockets)$/.test(text) || /\b(check|show|open) (inventory|bag|pockets)\b/.test(text) || /what (do )?i (have|carry)/.test(text)) {
    return action('inventory');
  }
  if (/^(hint|clue|help me|i'?m stuck|stuck|give me hint|need hint)$/.test(text) || /\b(hint|i am stuck|i'm stuck)\b/.test(text)) {
    return action('hint');
  }
  if (/^(help|commands|\?)$/.test(text)) return action('help');
  if (/^(l|look|look around|where am i|describe room|describe surroundings|look at room|scan room)$/.test(text)) {
    return action('look');
  }

  // Numeric codes: "enter 0745", "punch 0745 into the keypad".
  const digits = text.match(/\b(\d{4})\b/);
  if (digits) {
    const obj = findEntity(text, OBJECT_INDEX);
    return action('enter', { code: digits[1], target: obj ? obj.id : 'none' });
  }

  // "use X on Y", "shine flashlight at shelf", "swipe card on reader", "unlock door with keycard"
  const withMatch = text.match(/^(?:unlock|open)\s+(.+?)\s+(?:with|using)\s+(.+)$/);
  if (withMatch) {
    const target = findEntity(withMatch[1], OBJECT_INDEX);
    const item = findEntity(withMatch[2], ITEM_INDEX);
    if (target && item) return action('use', { item: item.id, target: target.id });
  }
  const useMatch = text.match(/^(?:use|shine|point|swipe|insert|put|try|scan|hold)\s+(.+?)\s+(?:on|at|in|into|onto|over|against|to|with|toward|towards)\s+(.+)$/);
  if (useMatch) {
    const item = findEntity(useMatch[1], ITEM_INDEX);
    const target = findEntity(useMatch[2], OBJECT_INDEX);
    if (item && target) return action('use', { item: item.id, target: target.id });
    return null;
  }

  // Word passwords: "type neuron into terminal", "password is neuron".
  const typed = text.match(/\b(?:type|enter|input|key in|punch in|submit|password is|password)\s+'?([a-z]{3,20})'?\b/);
  if (typed && !findEntity(typed[1], ALL_INDEX) && !/^(into|onto|code|password|word|something|what|it|is|in|on)$/.test(typed[1])) {
    const obj = findEntity(text, OBJECT_INDEX);
    return action('enter', { code: typed[1], target: obj ? obj.id : 'none' });
  }

  const takeMatch = text.match(/^(?:take|grab|pick up|pick|get|collect|steal|pocket|dig|dig up|remove)\s+(.+)$/);
  if (takeMatch) {
    const ent = findEntity(takeMatch[1], ALL_INDEX);
    if (ent) return action('take', { target: ent.id });
    return null;
  }

  const openMatch = text.match(/^(?:open|unlock|pull|push|pry|force|kick)\s+(.+)$/);
  if (openMatch) {
    const ent = findEntity(openMatch[1], OBJECT_INDEX);
    if (ent) return action('open', { target: ent.id });
    return null;
  }

  const examineMatch = text.match(/^(?:examine|inspect|look at|look in|look inside|look behind|look under|check|read|search|study|x|observe|view)\s+(.+)$/);
  if (examineMatch) {
    const ent = findEntity(examineMatch[1], ALL_INDEX);
    if (ent) return action('examine', { target: ent.id });
    return null;
  }

  // A bare object name ("clock", "the poster") is treated as examine.
  const bare = findEntity(text, ALL_INDEX);
  if (bare && text.split(' ').length <= 2) return action('examine', { target: bare.id });

  return null;
}
