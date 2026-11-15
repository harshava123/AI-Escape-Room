// Fast, free, deterministic parser for common commands.
// Returns a structured action, or null when the input is too ambiguous -
// in which case the orchestrator falls back to Gemini for understanding.
// The vocabulary comes from the current room, so AI-generated rooms work too.

const indexCache = new WeakMap();

function buildIndex(room) {
  if (indexCache.has(room)) return indexCache.get(room);
  const entries = (defs, kind) => Object.entries(defs).flatMap(([id, def]) => def.aliases.map((alias) => ({ id, alias, kind })));
  const byLength = (a, b) => b.alias.length - a.alias.length;
  const objects = entries(room.objects, 'object').sort(byLength);
  const items = entries(room.items, 'item').sort(byLength);
  const index = { objects, items, all: [...objects, ...items].sort(byLength) };
  indexCache.set(room, index);
  return index;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findEntity(text, index) {
  for (const { id, alias, kind } of index) {
    if (new RegExp(`(?<![a-z0-9])${escapeRe(alias)}(?![a-z0-9])`).test(text)) return { id, kind };
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

export function parseLocal(input, room) {
  const text = normalize(input);
  if (!text) return null;
  const idx = buildIndex(room);

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
    const obj = findEntity(text, idx.objects);
    return action('enter', { code: digits[1], target: obj ? obj.id : 'none' });
  }

  // "unlock door with keycard", "use X on Y", "shine flashlight at shelf", "swipe card on reader"
  const withMatch = text.match(/^(?:unlock|open)\s+(.+?)\s+(?:with|using)\s+(.+)$/);
  if (withMatch) {
    const target = findEntity(withMatch[1], idx.objects);
    const item = findEntity(withMatch[2], idx.items);
    if (target && item) return action('use', { item: item.id, target: target.id });
  }
  const useMatch = text.match(/^(?:use|shine|point|swipe|insert|put|try|scan|hold|wave|apply|place)\s+(.+?)\s+(?:on|at|in|into|onto|over|against|to|with|toward|towards|across)\s+(.+)$/);
  if (useMatch) {
    const item = findEntity(useMatch[1], idx.items);
    const target = findEntity(useMatch[2], idx.objects);
    if (item && target) return action('use', { item: item.id, target: target.id });
    return null;
  }

  // Word passwords: "type neuron into terminal", "password is neuron".
  const typed = text.match(/\b(?:type|enter|input|key in|punch in|submit|password is|password)\s+'?([a-z]{3,20})'?\b/);
  if (typed && !findEntity(typed[1], idx.all) && !/^(into|onto|code|password|word|something|what|it|is|in|on)$/.test(typed[1])) {
    const obj = findEntity(text, idx.objects);
    return action('enter', { code: typed[1], target: obj ? obj.id : 'none' });
  }

  const takeMatch = text.match(/^(?:take|grab|pick up|pick|get|collect|steal|pocket|dig|dig up|remove)\s+(.+)$/);
  if (takeMatch) {
    const ent = findEntity(takeMatch[1], idx.all);
    if (ent) return action('take', { target: ent.id });
    return null;
  }

  const openMatch = text.match(/^(?:open|unlock|pull|push|pry|force|kick)\s+(.+)$/);
  if (openMatch) {
    const ent = findEntity(openMatch[1], idx.objects);
    if (ent) return action('open', { target: ent.id });
    return null;
  }

  const examineMatch = text.match(/^(?:examine|inspect|look at|look in|look inside|look behind|look under|check|read|search|study|x|observe|view)\s+(.+)$/);
  if (examineMatch) {
    const ent = findEntity(examineMatch[1], idx.all);
    if (ent) return action('examine', { target: ent.id });
    return null;
  }

  // A bare object name ("clock", "the poster") is treated as examine.
  const bare = findEntity(text, idx.all);
  if (bare && text.split(' ').length <= 3) return action('examine', { target: bare.id });

  return null;
}
