// Shared room format used by the classic room and by AI-generated rooms.
//
// Every room follows the same verified puzzle chain, expressed as *roles*:
//   codeClue + riddle -> 4-digit code -> lockbox (contains tool)
//   tool on revealSurface -> password -> passwordLock (opens compartment)
//   compartment -> exitKey -> exit
//   decoy hides decoyItem (a red herring)
// What each role *is* (a clock, a star chart, a ship's log...) is free content.

export const OBJECT_ROLES = ['exit', 'codeClue', 'riddle', 'furniture', 'lockbox', 'revealSurface', 'passwordLock', 'compartment', 'decoy'];
export const ITEM_ROLES = ['tool', 'exitKey', 'decoyItem'];
export const HINT_STAGES = ['lockbox', 'reveal', 'passwordLock', 'exitKey', 'exit'];

export const ICONS = [
  'door', 'hatch', 'gate', 'clock', 'calendar', 'poster', 'painting', 'note', 'map', 'desk', 'table', 'drawer', 'safe',
  'chest', 'bookshelf', 'book', 'mirror', 'statue', 'terminal', 'radio', 'vent', 'crate', 'plant', 'lamp', 'flashlight',
  'lens', 'key', 'keycard', 'gem', 'coin', 'scroll', 'bottle', 'skull',
];

// Words players use as commands; never allowed as object aliases.
const RESERVED = new Set(['look', 'inventory', 'hint', 'help', 'use', 'take', 'open', 'enter', 'type', 'examine', 'it', 'room', 'around', 'me']);

const MAX_TEXT = 320;

export function cleanText(value, max = MAX_TEXT) {
  return String(value ?? '')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function normalizeAlias(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Regex that finds the code even when the model formats it, e.g. "0745", "07:45", "7-4-5" for 0745.
export function codePattern(code) {
  const variants = [code];
  if (code.startsWith('0')) variants.push(code.replace(/^0+/, ''));
  const parts = variants.filter((v) => v.length >= 3).map((v) => v.split('').join('[^0-9a-z]{0,2}'));
  return new RegExp(`(?<![0-9])(${parts.join('|')})(?![0-9])`, 'i');
}

export const digitsContain = (text, code) => String(text).replace(/\D/g, '').includes(code) || String(text).replace(/\D/g, '').includes(code.replace(/^0+/, ''));

export function passwordPattern(password) {
  return new RegExp(`\\b${password}\\b`, 'i');
}

// Validates and normalizes a room. Throws an Error listing every problem found.
export function validateRoom(raw, { code } = {}) {
  const errors = [];
  const room = {
    id: cleanText(raw?.id || `room-${Date.now()}`, 60),
    name: cleanText(raw?.name, 60),
    theme: cleanText(raw?.theme, 80),
    intro: cleanText(raw?.intro, 600),
    escapeText: cleanText(raw?.escapeText, 300),
    code: String(code ?? raw?.code ?? ''),
    password: String(raw?.password ?? '').toUpperCase().trim(),
    aiGenerated: !!raw?.aiGenerated,
    objects: {},
    items: {},
    hints: {},
  };

  if (!room.name) errors.push('name is missing');
  if (room.intro.length < 40) errors.push('intro is too short');
  if (!room.escapeText) errors.push('escapeText is missing');
  if (!/^\d{4}$/.test(room.code)) errors.push('code must be exactly 4 digits');
  if (!/^[A-Z]{4,10}$/.test(room.password)) errors.push('password must be one word of 4-10 letters A-Z');

  const usedAliases = new Set();
  const build = (role, def, kind) => {
    const name = cleanText(def?.name, 40);
    const description = cleanText(def?.description);
    const icon = ICONS.includes(def?.icon) ? def.icon : kind === 'item' ? 'key' : 'crate';
    if (!name) errors.push(`${role}.name is missing`);
    if (description.length < 15) errors.push(`${role}.description is too short`);

    const aliases = [];
    for (const a of [name, ...(Array.isArray(def?.aliases) ? def.aliases : [])]) {
      const alias = normalizeAlias(a);
      if (!alias || alias.length < 2 || alias.length > 30 || RESERVED.has(alias) || usedAliases.has(alias)) continue;
      usedAliases.add(alias);
      aliases.push(alias);
    }
    if (!aliases.length) errors.push(`${role} has no usable alias`);
    return { name, description, icon, aliases };
  };

  for (const role of OBJECT_ROLES) room.objects[role] = build(role, raw?.objects?.[role], 'object');
  for (const role of ITEM_ROLES) room.items[role] = build(role, raw?.items?.[role], 'item');

  for (const stage of HINT_STAGES) {
    const list = Array.isArray(raw?.hints?.[stage]) ? raw.hints[stage].map((h) => cleanText(h, 200)).filter(Boolean) : [];
    if (list.length < 2) errors.push(`hints.${stage} needs 2 hints`);
    room.hints[stage] = list.slice(0, 2);
  }

  // Solvability and secrecy checks.
  if (errors.length === 0) {
    const codeRe = codePattern(room.code);
    const pwRe = passwordPattern(room.password);

    if (!digitsContain(room.objects.codeClue.description, room.code)) errors.push('codeClue.description must contain the 4-digit code');

    const mustNotContainCode = [
      room.intro, room.escapeText,
      ...OBJECT_ROLES.filter((r) => r !== 'codeClue').map((r) => room.objects[r].description),
      ...ITEM_ROLES.map((r) => room.items[r].description),
      ...Object.values(room.hints).flat(),
    ];
    if (mustNotContainCode.some((t) => codeRe.test(t))) errors.push('the code appears outside codeClue.description');

    const allText = [
      room.name, room.intro, room.escapeText,
      ...OBJECT_ROLES.flatMap((r) => [room.objects[r].description, ...room.objects[r].aliases]),
      ...ITEM_ROLES.flatMap((r) => [room.items[r].description, ...room.items[r].aliases]),
      ...Object.values(room.hints).flat(),
    ];
    if (allText.some((t) => pwRe.test(t))) errors.push('the password appears in the room text - it must only be revealed by the tool');

    const names = [...OBJECT_ROLES.map((r) => room.objects[r].name), ...ITEM_ROLES.map((r) => room.items[r].name)].map((n) => n.toLowerCase());
    if (new Set(names).size !== names.length) errors.push('object and item names must be unique');
  }

  if (errors.length) {
    const err = new Error(`Invalid room: ${errors.join('; ')}`);
    err.errors = errors;
    throw err;
  }
  return room;
}

// The safe, client-facing view of a room. Contains no code, password or hint text.
export function publicRoom(room) {
  return {
    name: room.name,
    theme: room.theme,
    aiGenerated: room.aiGenerated,
    objects: OBJECT_ROLES.map((role) => ({ id: role, name: room.objects[role].name, icon: room.objects[role].icon })),
    items: Object.fromEntries(ITEM_ROLES.map((role) => [role, { name: room.items[role].name, icon: room.items[role].icon }])),
  };
}
