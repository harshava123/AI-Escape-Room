// Hand-made rooms expressed in the shared room format, one per campaign level.
// Used in Classic mode, when no API key is set, or when an AI-generated room
// fails validation.

import { validateRoom } from '../room-format.js';

const LAB = {
  id: 'room-404',
  name: 'Room 404: The Forgotten Lab',
  theme: 'abandoned AI research lab',
  code: '0745',
  password: 'NEURON',
  intro:
    'You wake up on the cold floor of an abandoned AI research lab. Emergency lights flicker red. ' +
    'A synthetic voice crackles: "ECHO security online. Lockdown active." ' +
    'You see a steel door, a wall clock, a poster, a desk with a drawer, a bookshelf, an old terminal, an air vent and a potted plant.',
  escapeText: 'The locks thunder open and cold fresh air rushes in. You are free!',
  objects: {
    exit: { name: 'steel door', aliases: ['door', 'card reader', 'reader', 'exit'], icon: 'door', description: 'A heavy steel door. Beside it, a card reader glows red.' },
    codeClue: { name: 'wall clock', aliases: ['clock', 'time'], icon: 'clock', description: 'A cracked wall clock. Its hands are frozen at exactly 07:45. The second hand twitches but never moves.' },
    riddle: { name: 'poster', aliases: ['sign'], icon: 'poster', description: 'A faded motivational poster reads: "TIME REVEALS ALL - the moment everything stopped is your key."' },
    furniture: { name: 'desk', aliases: ['metal desk', 'table'], icon: 'desk', description: 'A cluttered metal desk covered in coffee rings and old printouts.' },
    lockbox: { name: 'drawer', aliases: ['keypad', 'desk drawer'], icon: 'drawer', description: 'A sturdy desk drawer with a small numeric keypad.' },
    revealSurface: { name: 'bookshelf', aliases: ['bookcase', 'shelves', 'shelf', 'books', 'back panel'], icon: 'bookshelf', description: 'Shelves full of dusty machine learning textbooks. The wooden back panel looks oddly clean.' },
    passwordLock: { name: 'terminal', aliases: ['computer', 'monitor', 'screen', 'sticky note', 'crt', 'pc'], icon: 'terminal', description: 'An old CRT terminal blinks "ECHO SECURITY". A sticky note on the frame says: "Where knowledge glows in the dark."' },
    compartment: { name: 'air vent', aliases: ['vent', 'grate', 'grill', 'duct'], icon: 'vent', description: 'A metal air vent near the floor with a small electronic lock.' },
    decoy: { name: 'potted plant', aliases: ['plant', 'plant pot', 'pot', 'soil'], icon: 'plant', description: 'A dried-out potted plant in cracked soil.' },
  },
  items: {
    tool: { name: 'UV flashlight', aliases: ['uv light', 'uv torch', 'flashlight', 'torch', 'uv', 'light'], icon: 'flashlight', description: 'A compact flashlight that emits ultraviolet light. Hidden ink glows under it.' },
    exitKey: { name: 'keycard', aliases: ['access card', 'key card', 'card'], icon: 'keycard', description: 'A white ECHO Labs access card with a magnetic stripe.' },
    decoyItem: { name: 'rusty key', aliases: ['old key', 'key'], icon: 'key', description: 'An old, rusty iron key. It looks far older than anything else in this lab.' },
  },
  hints: {
    lockbox: ['The drawer wants a 4-digit code. Something in this room stopped at an important moment.', 'Read the poster, then take a careful look at the clock.'],
    reveal: ['Your new tool shows things the naked eye cannot see. The terminal note mentions knowledge glowing.', 'Where is knowledge kept in this room? Shine your light there.'],
    passwordLock: ['You found a word. Something in this room is asking for a password.', 'The terminal is waiting for a password.'],
    exitKey: ['The terminal said a lock was released somewhere in the room.', 'Check the air vent.'],
    exit: ['You already hold everything you need to leave.', 'The door has a card reader.'],
  },
};

const TOMB = {
  id: 'pharaoh-tomb',
  name: "The Pharaoh's Tomb",
  theme: "a pharaoh's sealed burial chamber",
  code: '3150',
  password: 'OSIRIS',
  intro:
    'Torchlight flickers as a stone slab slams shut behind you. You are sealed inside a pharaoh\'s burial chamber. ' +
    'ECHO\'s voice echoes off the walls: "Level two. The dead keep their secrets better than machines." ' +
    'You see a tomb door, a stone tablet, a wall carving, a sarcophagus, a stone chest, a star ceiling, a sphinx statue, a sealed alcove and a clay jar.',
  escapeText: 'The ankh clicks into place and the great door grinds open. Desert wind and sunlight pour in. You are free!',
  objects: {
    exit: { name: 'tomb door', aliases: ['door', 'stone door', 'exit', 'recess'], icon: 'door', description: 'A massive stone door with an ankh-shaped recess carved in its centre.' },
    codeClue: { name: 'stone tablet', aliases: ['tablet', 'king list', 'reigns'], icon: 'scroll', description: 'A cracked stone tablet lists the reigns of forgotten kings. One line is carved deeper than the rest: "Year of the First Crown - 3150."' },
    riddle: { name: 'wall carving', aliases: ['carving', 'hieroglyphs', 'glyphs', 'jackal'], icon: 'painting', description: 'Beside a jackal-headed god, hieroglyphs read: "Count from the day the first crown was worn, and stone will yield to you."' },
    furniture: { name: 'sarcophagus', aliases: ['coffin', 'mummy', 'lid'], icon: 'skull', description: 'A painted sarcophagus rests on a stone platform. Its lid has not moved in three thousand years.' },
    lockbox: { name: 'stone chest', aliases: ['chest', 'rings', 'number rings'], icon: 'chest', description: 'A heavy stone chest sealed by four rotating rings of carved numerals.' },
    revealSurface: { name: 'star ceiling', aliases: ['ceiling', 'stars', 'sky', 'painted ceiling'], icon: 'map', description: 'Golden stars painted on deep blue. Between them are marks far too tiny to read with the naked eye.' },
    passwordLock: { name: 'sphinx statue', aliases: ['sphinx', 'statue', 'letter tiles', 'tiles', 'inscription'], icon: 'statue', description: 'A small sphinx guards an alcove. Its mouth holds a row of letter tiles. An inscription reads: "Only those who read the heavens up close may speak my word."' },
    compartment: { name: 'sealed alcove', aliases: ['alcove', 'slab', 'niche'], icon: 'safe', description: 'A dark alcove behind the sphinx, closed by a sliding stone slab.' },
    decoy: { name: 'clay jar', aliases: ['jar', 'canopic jar', 'pot'], icon: 'bottle', description: 'A tall clay jar sealed with wax and painted with crocodiles.' },
  },
  items: {
    tool: { name: 'scarab lens', aliases: ['lens', 'scarab', 'crystal lens', 'magnifier'], icon: 'lens', description: 'A crystal lens set in a golden scarab. Tiny details become large through it.' },
    exitKey: { name: 'golden ankh', aliases: ['ankh', 'gold ankh'], icon: 'gem', description: 'A golden ankh, warm to the touch. Its shape matches a recess somewhere in this tomb.' },
    decoyItem: { name: 'bronze key', aliases: ['key', 'old key', 'corroded key'], icon: 'key', description: 'A green, corroded bronze key. Its teeth are worn almost smooth.' },
  },
  hints: {
    lockbox: ['The stone chest wants four numbers. The kings of this land kept careful records.', 'The wall carving speaks of the first crown. Read the stone tablet closely.'],
    reveal: ['The sphinx speaks of reading the heavens up close. Your new find makes small things large.', 'Use the scarab lens on the star ceiling.'],
    passwordLock: ['You found a name among the stars. Something here wants a word.', 'Spell the word with the letter tiles of the sphinx statue.'],
    exitKey: ['Stone ground against stone behind the guardian.', 'Look inside the sealed alcove.'],
    exit: ['The great door has a recess shaped like something you now carry.', 'Use the golden ankh on the tomb door.'],
  },
};

const STATION = {
  id: 'station-zero',
  name: 'Station Zero',
  theme: 'a crippled space station in orbit',
  code: '8317',
  password: 'AURORA',
  intro:
    'Red alarms pulse through Station Zero as the bulkhead seals behind you. Gravity is gone and the air is thinning. ' +
    'ECHO: "Final level. Up here, no one hears you guess." ' +
    'You see an airlock hatch, a mission log, scratched graffiti, a sleep pod, a supply locker, a frosted window, a command console, a power panel and a medical kit.',
  escapeText: 'The fuse slots in, the hatch hisses open and the escape pod launches toward the blue curve of Earth. You are free!',
  objects: {
    exit: { name: 'airlock hatch', aliases: ['hatch', 'airlock', 'escape pod', 'exit', 'door'], icon: 'hatch', description: 'The hatch to the escape pod. A dead fuse socket beside it keeps the airlock sealed.' },
    codeClue: { name: 'mission log', aliases: ['log', 'tablet', 'diary', 'logbook'], icon: 'book', description: 'The last entry scrolls on a cracked tablet: "Day 41. Crew of 6. Oxygen at 12 percent. Override logged at orbit 8317. Tell my family."' },
    riddle: { name: 'graffiti', aliases: ['scratches', 'scratched graffiti', 'message'], icon: 'poster', description: 'Someone scratched into the bulkhead: "The dead keep diaries. Count the orbits, never the days."' },
    furniture: { name: 'sleep pod', aliases: ['bed', 'bunk', 'blanket'], icon: 'crate', description: 'An empty sleep pod hums faintly. Its blanket drifts in zero gravity.' },
    lockbox: { name: 'supply locker', aliases: ['locker', 'dial', 'combination dial'], icon: 'safe', description: 'A dented supply locker held shut by a four-wheel combination dial.' },
    revealSurface: { name: 'frosted window', aliases: ['window', 'viewport', 'glass', 'frost'], icon: 'mirror', description: 'A viewport fogged with frost. Someone touched it not long ago - a faint pattern lingers that your eyes cannot catch.' },
    passwordLock: { name: 'command console', aliases: ['console', 'screen', 'computer', 'taped note', 'override'], icon: 'terminal', description: 'The main console flashes OVERRIDE REQUIRED. A taped note reads: "Warm fingers leave words on cold glass."' },
    compartment: { name: 'power panel', aliases: ['panel', 'breaker', 'wall panel'], icon: 'vent', description: 'A sealed power panel on the wall, its door locked by the console.' },
    decoy: { name: 'medical kit', aliases: ['medkit', 'med kit', 'first aid kit', 'kit'], icon: 'chest', description: 'A white medical kit strapped to the wall. One latch is already open.' },
  },
  items: {
    tool: { name: 'thermal goggles', aliases: ['goggles', 'visor', 'thermal visor'], icon: 'lens', description: 'Heavy goggles that see heat. Warm traces glow orange through the lenses.' },
    exitKey: { name: 'power fuse', aliases: ['fuse', 'blue fuse'], icon: 'gem', description: 'A glowing blue power fuse - exactly what an escape pod needs.' },
    decoyItem: { name: 'access chip', aliases: ['chip', 'captain chip', 'crew chip', 'card'], icon: 'keycard', description: 'A silver crew access chip stamped CAPTAIN. It looks very important.' },
  },
  hints: {
    lockbox: ['The locker wants four digits. The crew wrote everything down.', 'The graffiti says to count orbits, not days. Read the mission log.'],
    reveal: ['The console note talks about warmth on cold glass. Your new gear sees heat.', 'Use the thermal goggles on the frosted window.'],
    passwordLock: ['You found a word on the glass. The station needs an override.', 'Enter the word into the command console.'],
    exitKey: ['Something on the wall unlocked when the override went through.', 'Check the power panel.'],
    exit: ['The escape pod needs power.', 'Use the power fuse on the airlock hatch.'],
  },
};

const CLASSIC_ROOMS = [LAB, TOMB, STATION];

export const classicRoom = (level = 1) => validateRoom(CLASSIC_ROOMS[Math.min(Math.max(1, level), CLASSIC_ROOMS.length) - 1]);
