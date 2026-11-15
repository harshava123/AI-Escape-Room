// Deterministic game engine. It is the single source of truth for game state:
// the LLM can phrase things, but only this module decides what happens.

import { ROOM, OBJECTS, ITEMS, STAGES, SECRETS } from './room.js';

export const INTENTS = ['look', 'examine', 'take', 'open', 'use', 'enter', 'inventory', 'hint', 'help', 'unknown'];

export const ACHIEVEMENTS = {
  first_item: { title: 'Scavenger', description: 'Pick up your first item.' },
  red_herring: { title: 'Not Everything Fits', description: 'Try the rusty key on something.' },
  social_engineer: { title: 'Nice Try', description: 'Attempt to trick the AI into revealing answers.' },
  escaped: { title: 'Free at Last', description: 'Escape Room 404.' },
  no_hints: { title: 'Pure Genius', description: 'Escape without using a single hint.' },
  speedrun: { title: 'Speedrunner', description: 'Escape in under 3 minutes.' },
};

export function createGame(now = Date.now()) {
  return {
    flags: {
      clockSeen: false,
      drawerOpen: false,
      wordRevealed: false,
      terminalUnlocked: false,
      ventOpen: false,
      plantSearched: false,
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
    deadline: now + ROOM.timeLimitMs,
    finishedAt: null,
  };
}

export function currentStageIndex(state) {
  const f = state.flags;
  if (!f.drawerOpen) return 0;
  if (!f.wordRevealed) return 1;
  if (!f.terminalUnlocked) return 2;
  if (!state.inventory.includes('keycard')) return 3;
  if (!f.escaped) return 4;
  return STAGES.length;
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

function addItem(state, itemId, unlocked) {
  if (!state.inventory.includes(itemId)) state.inventory.push(itemId);
  grant(state, 'first_item', unlocked);
}

const has = (state, itemId) => state.inventory.includes(itemId);

function result(event, message, success = null, extra = {}) {
  return { event, message, success, ...extra };
}

function describe(state, target) {
  const f = state.flags;
  switch (target) {
    case 'door':
      return result('examine', 'A heavy steel door. Beside it, a card reader glows red: "ACCESS CARD REQUIRED".');
    case 'clock':
      learn(state, 'clockTime');
      f.clockSeen = true;
      return result('clue', 'A cracked wall clock. Its hands are frozen at exactly 7:45. The second hand twitches but never moves.', true);
    case 'poster':
      return result('clue', 'A faded motivational poster reads: "TIME REVEALS ALL - the moment everything stopped is your key."', true);
    case 'desk':
      return f.drawerOpen
        ? result('examine', 'A cluttered metal desk. Its drawer hangs open and empty.')
        : result('examine', 'A cluttered metal desk covered in coffee rings. One drawer is sealed with a 4-digit keypad.');
    case 'drawer':
      return f.drawerOpen
        ? result('examine', 'The drawer is open and empty.')
        : result('examine', 'The drawer is locked. A small keypad waits for a 4-digit code.');
    case 'bookshelf':
      return f.wordRevealed
        ? result('examine', 'Dusty machine learning textbooks. On the back panel, glowing letters spell NEURON.')
        : result('examine', 'Shelves full of dusty machine learning textbooks. The wooden back panel looks oddly clean, as if something was painted there.');
    case 'terminal':
      return f.terminalUnlocked
        ? result('examine', 'The terminal reads: "ACCESS GRANTED. Vent lock released."')
        : result('examine', 'An old CRT terminal blinks: "ECHO SECURITY - ENTER PASSWORD". A sticky note on the frame says: "Where knowledge glows in the dark."');
    case 'vent':
      if (!f.terminalUnlocked) return result('examine', 'A metal air vent near the floor, sealed by a small electronic lock with a red LED.');
      if (has(state, 'keycard')) return result('examine', 'The vent grate hangs open. Nothing else is inside.');
      f.ventOpen = true;
      return result('examine', 'The vent lock LED is green and the grate has swung open. A white keycard lies inside.', true);
    case 'plant':
      if (has(state, 'rusty_key')) return result('examine', 'A dried-out potted plant. You already dug through the soil.');
      f.plantSearched = true;
      return result('examine', 'A dried-out potted plant. Something metallic glints in the dry soil - an old rusty key.');
    default:
      if (ITEMS[target] && has(state, target)) return result('examine', ITEMS[target].description);
      return result('unknown_target', "You don't see anything like that here.", false);
  }
}

function take(state, target, unlocked) {
  if (target === 'keycard') {
    if (has(state, 'keycard')) return result('noop', 'You already have the keycard.');
    if (!state.flags.terminalUnlocked) return result('unknown_target', "You don't see a keycard anywhere.", false);
    state.flags.ventOpen = true;
    addItem(state, 'keycard', unlocked);
    return result('item', 'You reach into the open vent and take the keycard.', true, { item: 'keycard' });
  }
  if (target === 'rusty_key' || target === 'plant') {
    if (has(state, 'rusty_key')) return result('noop', 'You already have the rusty key.');
    state.flags.plantSearched = true;
    addItem(state, 'rusty_key', unlocked);
    return result('item', 'You dig the rusty key out of the dry soil.', true, { item: 'rusty_key' });
  }
  if (target === 'uv_flashlight') {
    if (has(state, 'uv_flashlight')) return result('noop', 'You already have the UV flashlight.');
    return result('unknown_target', "You don't see a flashlight anywhere.", false);
  }
  if (OBJECTS[target]) return result('noop', `The ${OBJECTS[target].name} is not something you can carry.`, false);
  return result('unknown_target', "There's nothing like that to take.", false);
}

function open(state, target) {
  const f = state.flags;
  switch (target) {
    case 'door':
      return result('locked', 'The door does not budge. The card reader blinks red.', false);
    case 'drawer':
    case 'desk':
      return f.drawerOpen
        ? result('noop', 'The drawer is already open.')
        : result('locked', 'The drawer is locked. The keypad wants a 4-digit code.', false);
    case 'vent':
      return f.terminalUnlocked ? describe(state, 'vent') : result('locked', 'The vent is held shut by an electronic lock.', false);
    case 'terminal':
      return describe(state, 'terminal');
    default:
      return result('noop', "That isn't something you can open.", false);
  }
}

function enter(state, code, target, unlocked) {
  const cleaned = String(code || '').trim();
  if (!cleaned) return result('noop', 'Enter what? Try something like "enter 1234 on the drawer".', false);

  const resolvedTarget = target && target !== 'none' ? target : /^\d+$/.test(cleaned) ? 'drawer' : 'terminal';

  if (resolvedTarget === 'drawer' || resolvedTarget === 'desk') {
    if (state.flags.drawerOpen) return result('noop', 'The drawer is already open.');
    if (cleaned.replace(/\D/g, '') === SECRETS.drawerCode) {
      state.flags.drawerOpen = true;
      learn(state, 'drawerCode');
      addItem(state, 'uv_flashlight', unlocked);
      return result('unlock', 'The keypad beeps twice and the drawer slides open. Inside is a UV flashlight - you take it.', true, {
        item: 'uv_flashlight',
      });
    }
    state.wrongAttempts++;
    return result('wrong_code', `The keypad flashes red: "${cleaned.slice(0, 8)}" - INVALID CODE.`, false);
  }

  if (resolvedTarget === 'terminal') {
    if (state.flags.terminalUnlocked) return result('noop', 'The terminal is already unlocked.');
    if (cleaned.toUpperCase() === SECRETS.password) {
      state.flags.terminalUnlocked = true;
      learn(state, 'password');
      return result('unlock', 'The terminal chimes: "ACCESS GRANTED. Vent lock released." Across the room, something clicks.', true);
    }
    state.wrongAttempts++;
    return result('wrong_code', 'The terminal buzzes: "ACCESS DENIED."', false);
  }

  return result('noop', `There is nowhere on the ${OBJECTS[resolvedTarget]?.name || 'that'} to enter a code.`, false);
}

function use(state, item, target, unlocked, now) {
  if (!item || item === 'none') {
    if (target === 'terminal') return describe(state, 'terminal');
    return open(state, target);
  }
  if (!ITEMS[item]) return result('unknown_target', "You don't have anything like that.", false);
  if (!has(state, item)) return result('missing_item', `You don't have the ${ITEMS[item].name}.`, false);
  if (!target || target === 'none') return result('noop', `Use the ${ITEMS[item].name} on what?`, false);

  if (item === 'rusty_key') {
    grant(state, 'red_herring', unlocked);
    return result('red_herring', `You try the rusty key on the ${OBJECTS[target]?.name || target}. It doesn't fit anything in this lab.`, false);
  }

  if (item === 'uv_flashlight') {
    if (target === 'bookshelf') {
      state.flags.wordRevealed = true;
      learn(state, 'password');
      return result('reveal', 'Under the UV beam, glowing letters appear on the bookshelf back panel: NEURON.', true);
    }
    return result('noop', `You sweep the UV light over the ${OBJECTS[target]?.name || target}. Nothing glows.`, false);
  }

  if (item === 'keycard') {
    if (target === 'door') {
      state.flags.escaped = true;
      state.finishedAt = now;
      grant(state, 'escaped', unlocked);
      if (state.hintsUsed === 0) grant(state, 'no_hints', unlocked);
      if (now - state.startedAt < 3 * 60 * 1000) grant(state, 'speedrun', unlocked);
      return result('escaped', 'You swipe the keycard. The reader turns green, the locks thunder open and cold fresh air rushes in. You are free!', true);
    }
    return result('noop', `Nothing happens when you use the keycard on the ${OBJECTS[target]?.name || target}.`, false);
  }

  return result('noop', 'Nothing happens.', false);
}

export function getHint(state) {
  const idx = currentStageIndex(state);
  if (idx >= STAGES.length) return result('hint', 'You have already escaped!');
  const stage = STAGES[idx];
  const tier = Math.min(state.hintTier[stage.id] || 0, stage.hints.length - 1);
  state.hintTier[stage.id] = tier + 1;
  state.hintsUsed++;
  if (tier === stage.hints.length - 1) {
    if (stage.id === 'drawer') learn(state, 'drawerCode');
    if (stage.id === 'reveal' || stage.id === 'terminal') learn(state, 'password');
  }
  return result('hint', stage.hints[tier], null, { hintTier: tier + 1 });
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
  state.moves++;

  let out;
  switch (intent) {
    case 'look':
      out = result('look', ROOM.intro);
      break;
    case 'examine':
      out = target && target !== 'none' ? describe(state, target) : result('look', ROOM.intro);
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
        state.inventory.length ? `You are carrying: ${state.inventory.map((i) => ITEMS[i].name).join(', ')}.` : 'Your pockets are empty.',
      );
      break;
    case 'hint':
      out = getHint(state);
      break;
    case 'help':
      out = result(
        'help',
        'Try commands like "look around", "examine the clock", "enter 1234 on the drawer", "use flashlight on bookshelf", "take keycard" or ask for a hint.',
      );
      break;
    default:
      out = result('unknown', "That doesn't seem to do anything. Try examining objects in the room or ask for a hint.", false);
  }

  return { ...out, achievements: unlocked };
}

export function publicState(state, now = Date.now()) {
  const stageIdx = currentStageIndex(state);
  return {
    status: status(state, now),
    inventory: state.inventory.map((id) => ({ id, name: ITEMS[id].name, description: ITEMS[id].description })),
    stages: STAGES.map((s, i) => ({ id: s.id, title: i <= stageIdx ? s.title : '???', done: i < stageIdx })),
    stageIndex: stageIdx,
    progress: Math.round((stageIdx / STAGES.length) * 100),
    objects: {
      drawer: state.flags.drawerOpen ? 'open' : 'locked',
      terminal: state.flags.terminalUnlocked ? 'unlocked' : 'locked',
      vent: state.flags.terminalUnlocked ? 'open' : 'locked',
      door: state.flags.escaped ? 'open' : 'locked',
      bookshelf: state.flags.wordRevealed ? 'revealed' : 'normal',
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
