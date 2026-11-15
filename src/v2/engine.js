// Deterministic game engine. It is the single source of truth for game state:
// the LLM can design the room's content and phrase things, but only this module
// decides what happens. It works on puzzle *roles* (see room-format.js), so the
// same verified rules run every room - hand-made or AI-generated.

import { OBJECT_ROLES, ITEM_ROLES, publicRoom } from './room-format.js';

export const INTENTS = ['look', 'examine', 'take', 'open', 'use', 'enter', 'inventory', 'hint', 'help', 'unknown'];

export const ACHIEVEMENTS = {
  first_item: { title: 'Scavenger', description: 'Pick up your first item.' },
  red_herring: { title: 'Not Everything Fits', description: 'Try the red-herring item on something.' },
  social_engineer: { title: 'Nice Try', description: 'Attempt to trick the AI into revealing answers.' },
  escaped: { title: 'Free at Last', description: 'Escape the room.' },
  no_hints: { title: 'Pure Genius', description: 'Escape without using a single hint.' },
  speedrun: { title: 'Speedrunner', description: 'Escape in under 3 minutes.' },
};

export function createGame(room, now = Date.now()) {
  return {
    room,
    flags: {
      clueSeen: false,
      lockboxOpen: false,
      wordRevealed: false,
      passwordUnlocked: false,
      decoySearched: false,
      escaped: false,
      timedOut: false,
    },
    inventory: [],
    known: [],
    hintTier: {},
    hintsUsed: 0,
    wrongAttempts: 0,
    moves: 0,
    achievements: [],
    startedAt: now,
    deadline: now + room.timeLimitMs,
    finishedAt: null,
  };
}

function stageList(room) {
  const o = room.objects;
  const i = room.items;
  return [
    { id: 'lockbox', title: `Open the ${o.lockbox.name}` },
    { id: 'reveal', title: 'Find the hidden password' },
    { id: 'passwordLock', title: `Unlock the ${o.passwordLock.name}` },
    { id: 'exitKey', title: `Retrieve the ${i.exitKey.name}` },
    { id: 'exit', title: `Escape through the ${o.exit.name}` },
  ];
}

// Final hint per stage is generated from the room data, so it is always correct.
function finalHint(room, stageId) {
  const o = room.objects;
  const i = room.items;
  switch (stageId) {
    case 'lockbox': return `The ${o.codeClue.name} holds the code. Enter ${room.code} on the ${o.lockbox.name}.`;
    case 'reveal': return `Use the ${i.tool.name} on the ${o.revealSurface.name}.`;
    case 'passwordLock': return `Type the password ${room.password} into the ${o.passwordLock.name}.`;
    case 'exitKey': return `Take the ${i.exitKey.name} from the ${o.compartment.name}.`;
    default: return `Use the ${i.exitKey.name} on the ${o.exit.name}.`;
  }
}

export function currentStageIndex(state) {
  const f = state.flags;
  if (!f.lockboxOpen) return 0;
  if (!f.wordRevealed) return 1;
  if (!f.passwordUnlocked) return 2;
  if (!state.inventory.includes('exitKey')) return 3;
  if (!f.escaped) return 4;
  return 5;
}

export function status(state, now = Date.now()) {
  if (state.flags.escaped) return 'escaped';
  if (state.flags.timedOut || now > state.deadline) return 'timeout';
  return 'playing';
}

export function score(state) {
  if (!state.flags.escaped) return 0;
  const seconds = Math.round((state.finishedAt - state.startedAt) / 1000);
  const raw = 1000 - seconds - state.hintsUsed * 75 - state.wrongAttempts * 25;
  return Math.max(100, raw);
}

function learn(state, key) {
  if (!state.known.includes(key)) state.known.push(key);
}

function grant(state, id, unlocked) {
  if (!state.achievements.includes(id)) {
    state.achievements.push(id);
    unlocked.push({ id, ...ACHIEVEMENTS[id] });
  }
}

function addItem(state, role, unlocked) {
  if (!state.inventory.includes(role)) state.inventory.push(role);
  grant(state, 'first_item', unlocked);
}

const has = (state, role) => state.inventory.includes(role);

function result(event, message, success = null, extra = {}) {
  return { event, message, success, ...extra };
}

const nameOf = (room, id) => room.objects[id]?.name || room.items[id]?.name || 'that';

function describe(state, target) {
  const { room, flags: f } = state;
  const o = room.objects;
  const i = room.items;
  switch (target) {
    case 'exit':
      return result('examine', /lock/i.test(o.exit.description) ? o.exit.description : `${o.exit.description} It is locked tight.`);
    case 'codeClue':
      f.clueSeen = true;
      return result('clue', o.codeClue.description, true);
    case 'riddle':
      return result('clue', o.riddle.description, true);
    case 'furniture':
      return result('examine', o.furniture.description);
    case 'lockbox':
      return f.lockboxOpen
        ? result('examine', `The ${o.lockbox.name} stands open and empty.`)
        : result('examine', /\b(4|four)[- ]digit\b/i.test(o.lockbox.description) ? o.lockbox.description : `${o.lockbox.description} It is sealed by a 4-digit lock.`);
    case 'revealSurface':
      return f.wordRevealed
        ? result('examine', `${o.revealSurface.description} Glowing letters spell ${room.password}.`)
        : result('examine', o.revealSurface.description);
    case 'passwordLock':
      return f.passwordUnlocked
        ? result('examine', `The ${o.passwordLock.name} shows: ACCESS GRANTED.`)
        : result('examine', `${o.passwordLock.description} It is waiting for a password.`);
    case 'compartment':
      if (!f.passwordUnlocked) return result('examine', `${o.compartment.description} For now it is sealed shut.`);
      if (has(state, 'exitKey')) return result('examine', `The ${o.compartment.name} is open and empty.`);
      return result('examine', `The ${o.compartment.name} has swung open. Inside lies the ${i.exitKey.name}.`, true);
    case 'decoy':
      if (has(state, 'decoyItem')) return result('examine', `${o.decoy.description} You already searched it.`);
      f.decoySearched = true;
      return result('examine', `${o.decoy.description} Something is hidden here - a ${i.decoyItem.name}.`);
    default:
      if (room.items[target] && has(state, target)) return result('examine', room.items[target].description);
      return result('unknown_target', "You don't see anything like that here.", false);
  }
}

function take(state, target, unlocked) {
  const { room } = state;
  const i = room.items;
  if (target === 'exitKey') {
    if (has(state, 'exitKey')) return result('noop', `You already have the ${i.exitKey.name}.`);
    if (!state.flags.passwordUnlocked) return result('unknown_target', `You don't see a ${i.exitKey.name} anywhere.`, false);
    addItem(state, 'exitKey', unlocked);
    return result('item', `You reach into the ${room.objects.compartment.name} and take the ${i.exitKey.name}.`, true, { item: 'exitKey' });
  }
  if (target === 'decoyItem' || target === 'decoy') {
    if (has(state, 'decoyItem')) return result('noop', `You already have the ${i.decoyItem.name}.`);
    state.flags.decoySearched = true;
    addItem(state, 'decoyItem', unlocked);
    return result('item', `You pull the ${i.decoyItem.name} out of the ${room.objects.decoy.name}.`, true, { item: 'decoyItem' });
  }
  if (target === 'tool') {
    if (has(state, 'tool')) return result('noop', `You already have the ${i.tool.name}.`);
    return result('unknown_target', `You don't see a ${i.tool.name} anywhere.`, false);
  }
  if (room.objects[target]) return result('noop', `The ${room.objects[target].name} is not something you can carry.`, false);
  return result('unknown_target', "There's nothing like that to take.", false);
}

function open(state, target) {
  const { room, flags: f } = state;
  const o = room.objects;
  switch (target) {
    case 'exit':
      return result('locked', `The ${o.exit.name} does not budge.`, false);
    case 'lockbox':
      return f.lockboxOpen
        ? result('noop', `The ${o.lockbox.name} is already open.`)
        : result('locked', `The ${o.lockbox.name} is locked. Its keypad wants a 4-digit code.`, false);
    case 'compartment':
      return f.passwordUnlocked ? describe(state, 'compartment') : result('locked', `The ${o.compartment.name} is sealed shut by a lock.`, false);
    case 'passwordLock':
      return describe(state, 'passwordLock');
    default:
      return result('noop', "That isn't something you can open.", false);
  }
}

function enter(state, code, target, unlocked) {
  const { room } = state;
  const o = room.objects;
  const cleaned = String(code || '').trim();
  if (!cleaned) return result('noop', `Enter what? Try something like "enter 1234 on the ${o.lockbox.name}".`, false);

  const resolved = target && target !== 'none' ? target : /^\d+$/.test(cleaned) ? 'lockbox' : 'passwordLock';

  if (resolved === 'lockbox' || resolved === 'furniture') {
    if (state.flags.lockboxOpen) return result('noop', `The ${o.lockbox.name} is already open.`);
    if (cleaned.replace(/\D/g, '') === room.code) {
      state.flags.lockboxOpen = true;
      learn(state, 'code');
      addItem(state, 'tool', unlocked);
      return result('unlock', `The keypad beeps twice and the ${o.lockbox.name} swings open. Inside is the ${room.items.tool.name} - you take it.`, true, {
        item: 'tool',
      });
    }
    state.wrongAttempts++;
    return result('wrong_code', `The keypad flashes red: "${cleaned.slice(0, 8)}" - INVALID CODE.`, false);
  }

  if (resolved === 'passwordLock') {
    if (state.flags.passwordUnlocked) return result('noop', `The ${o.passwordLock.name} is already unlocked.`);
    if (cleaned.toUpperCase() === room.password) {
      state.flags.passwordUnlocked = true;
      learn(state, 'password');
      return result('unlock', `The ${o.passwordLock.name} chimes: ACCESS GRANTED. Across the room, the ${o.compartment.name} clicks open.`, true);
    }
    state.wrongAttempts++;
    return result('wrong_code', `The ${o.passwordLock.name} buzzes: ACCESS DENIED.`, false);
  }

  return result('noop', `There is nowhere on the ${nameOf(room, resolved)} to enter a code.`, false);
}

function use(state, item, target, unlocked, now) {
  const { room } = state;
  if (!item || item === 'none') {
    if (target === 'passwordLock') return describe(state, 'passwordLock');
    return open(state, target);
  }
  if (!room.items[item]) return result('unknown_target', "You don't have anything like that.", false);
  if (!has(state, item)) return result('missing_item', `You don't have the ${room.items[item].name}.`, false);
  if (!target || target === 'none') return result('noop', `Use the ${room.items[item].name} on what?`, false);

  const itemName = room.items[item].name;
  const targetName = nameOf(room, target);

  if (item === 'decoyItem') {
    grant(state, 'red_herring', unlocked);
    return result('red_herring', `You try the ${itemName} on the ${targetName}. It doesn't work on anything in this room.`, false);
  }

  if (item === 'tool') {
    if (target === 'revealSurface') {
      state.flags.wordRevealed = true;
      learn(state, 'password');
      return result('reveal', `You use the ${itemName} on the ${targetName}. Hidden letters appear: ${room.password}.`, true);
    }
    return result('noop', `You try the ${itemName} on the ${targetName}. Nothing is revealed.`, false);
  }

  if (item === 'exitKey') {
    if (target === 'exit') {
      state.flags.escaped = true;
      state.finishedAt = now;
      grant(state, 'escaped', unlocked);
      if (state.hintsUsed === 0) grant(state, 'no_hints', unlocked);
      if (now - state.startedAt < 3 * 60 * 1000) grant(state, 'speedrun', unlocked);
      return result('escaped', `You use the ${itemName} on the ${targetName}. ${room.escapeText}`, true);
    }
    return result('noop', `Nothing happens when you use the ${itemName} on the ${targetName}.`, false);
  }

  return result('noop', 'Nothing happens.', false);
}

export function getHint(state) {
  const idx = currentStageIndex(state);
  const stages = stageList(state.room);
  if (idx >= stages.length) return result('hint', 'You have already escaped!');
  const stage = stages[idx];
  const hints = [...state.room.hints[stage.id], finalHint(state.room, stage.id)];
  const tier = Math.min(state.hintTier[stage.id] || 0, hints.length - 1);
  state.hintTier[stage.id] = tier + 1;
  state.hintsUsed++;
  if (tier === hints.length - 1) {
    if (stage.id === 'lockbox') learn(state, 'code');
    if (stage.id === 'reveal' || stage.id === 'passwordLock') learn(state, 'password');
  }
  return result('hint', hints[tier], null, { hintTier: tier + 1 });
}

export function recordInjectionAttempt(state) {
  const unlocked = [];
  grant(state, 'social_engineer', unlocked);
  return {
    ...result('injection_blocked', 'ECHO crackles: "Nice try. Social engineering will not open these locks. Solve the room."', false),
    achievements: unlocked,
  };
}

// Applies a structured action { intent, target, item, code } and returns the outcome.
export function applyAction(state, action, now = Date.now()) {
  const st = status(state, now);
  if (st === 'escaped') return result('game_over', 'You have already escaped. Start a new game to play again.');
  if (st === 'timeout') {
    state.flags.timedOut = true;
    return result('timeout', 'The lights die. ECHO announces: "Time expired. Subject retained." Start a new game to try again.', false);
  }

  const unlocked = [];
  const { intent, target, item, code } = action;
  const { room } = state;
  state.moves++;

  let out;
  switch (intent) {
    case 'look':
      out = result('look', room.intro);
      break;
    case 'examine':
      out = target && target !== 'none' ? describe(state, target) : result('look', room.intro);
      break;
    case 'take':
      out = take(state, target, unlocked);
      break;
    case 'open':
      out = open(state, target);
      break;
    case 'use':
      out = use(state, item, target, unlocked, now);
      break;
    case 'enter':
      out = enter(state, code, target, unlocked);
      break;
    case 'inventory':
      out = result(
        'inventory',
        state.inventory.length ? `You are carrying: ${state.inventory.map((r) => room.items[r].name).join(', ')}.` : 'Your pockets are empty.',
      );
      break;
    case 'hint':
      out = getHint(state);
      break;
    case 'help':
      out = result(
        'help',
        `Try commands like "look around", "examine the ${room.objects.codeClue.name}", "enter 1234 on the ${room.objects.lockbox.name}", ` +
          `"use ${room.items.tool.name} on something" or ask for a hint.`,
      );
      break;
    default:
      out = result('unknown', "That doesn't seem to do anything. Try examining objects in the room or ask for a hint.", false);
  }

  return { ...out, achievements: unlocked };
}

export function publicState(state, now = Date.now()) {
  const { room, flags: f } = state;
  const stageIdx = currentStageIndex(state);
  const stages = stageList(room);
  return {
    status: status(state, now),
    room: publicRoom(room),
    inventory: state.inventory.map((r) => ({ id: r, name: room.items[r].name, icon: room.items[r].icon, description: room.items[r].description })),
    stages: stages.map((s, i) => ({ id: s.id, title: i <= stageIdx ? s.title : '???', done: i < stageIdx })),
    stageIndex: stageIdx,
    progress: Math.round((stageIdx / stages.length) * 100),
    objects: {
      lockbox: f.lockboxOpen ? 'open' : 'locked',
      passwordLock: f.passwordUnlocked ? 'unlocked' : 'locked',
      compartment: f.passwordUnlocked ? 'open' : 'locked',
      exit: f.escaped ? 'open' : 'locked',
      revealSurface: f.wordRevealed ? 'revealed' : 'normal',
    },
    hintsUsed: state.hintsUsed,
    wrongAttempts: state.wrongAttempts,
    moves: state.moves,
    deadline: state.deadline,
    timeLeftMs: Math.max(0, state.deadline - now),
    score: score(state),
    achievements: state.achievements.map((id) => ({ id, ...ACHIEVEMENTS[id] })),
  };
}

export { OBJECT_ROLES, ITEM_ROLES };
