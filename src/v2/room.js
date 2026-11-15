// Static definition of "Room 404: The Forgotten Lab".
// Solutions live here, on the server only. They are never sent to the LLM
// or to the browser.

export const ROOM = {
  id: 'room-404',
  name: 'Room 404: The Forgotten Lab',
  timeLimitMs: 15 * 60 * 1000,
  intro:
    'You wake up on the cold floor of an abandoned AI research lab. Emergency lights flicker red. ' +
    'A synthetic voice crackles: "ECHO security online. Lockdown active." ' +
    'You see a steel door, a wall clock, a poster, a desk, a bookshelf, an old terminal, an air vent and a potted plant.',
};

export const SECRETS = {
  drawerCode: '0745',
  password: 'NEURON',
};

// Patterns used by the output guard to detect a secret in LLM text.
// Each key is unlocked (allowed to appear) once the player has legitimately discovered it.
export const SECRET_PATTERNS = {
  clockTime: [/\b7\s*:\s*45\b/i, /quarter to eight/i],
  drawerCode: [/\b0\s*7\s*4\s*5\b/],
  password: [/neuron/i],
};

export const OBJECTS = {
  door: {
    name: 'steel door',
    aliases: ['steel door', 'card reader', 'reader', 'exit', 'door'],
  },
  clock: {
    name: 'wall clock',
    aliases: ['wall clock', 'clock', 'time'],
  },
  poster: {
    name: 'poster',
    aliases: ['poster', 'sign'],
  },
  desk: {
    name: 'desk',
    aliases: ['metal desk', 'desk', 'table'],
  },
  drawer: {
    name: 'drawer',
    aliases: ['drawer', 'keypad'],
  },
  bookshelf: {
    name: 'bookshelf',
    aliases: ['bookshelf', 'bookcase', 'shelves', 'shelf', 'books', 'book', 'back panel'],
  },
  terminal: {
    name: 'terminal',
    aliases: ['terminal', 'computer', 'monitor', 'screen', 'sticky note', 'note', 'crt', 'pc'],
  },
  vent: {
    name: 'air vent',
    aliases: ['air vent', 'vent', 'grate', 'grill', 'duct'],
  },
  plant: {
    name: 'potted plant',
    aliases: ['potted plant', 'plant pot', 'plant', 'pot', 'soil'],
  },
};

export const ITEMS = {
  uv_flashlight: {
    name: 'UV flashlight',
    aliases: ['uv flashlight', 'uv light', 'uv torch', 'flashlight', 'torch', 'uv', 'light'],
    description: 'A compact flashlight that emits ultraviolet light. Hidden ink glows under it.',
  },
  keycard: {
    name: 'keycard',
    aliases: ['access card', 'key card', 'keycard', 'card'],
    description: 'A white ECHO Labs access card with a magnetic stripe.',
  },
  rusty_key: {
    name: 'rusty key',
    aliases: ['rusty key', 'old key', 'key'],
    description: 'An old, rusty iron key. It looks far older than anything else in this lab.',
  },
};

// Ordered puzzle stages. The current stage drives hints and the progress bar.
export const STAGES = [
  {
    id: 'drawer',
    title: 'Open the locked drawer',
    hints: [
      'The drawer wants a 4-digit code. Something in this room stopped at an important moment.',
      'Read the poster, then take a careful look at the clock.',
      'The clock is frozen at 7:45. Enter 0745 on the drawer keypad.',
    ],
  },
  {
    id: 'reveal',
    title: 'Find the hidden password',
    hints: [
      'Your new tool shows things the naked eye cannot see. The terminal note mentions knowledge glowing.',
      'Where is knowledge kept in this room? Shine your light there.',
      'Use the UV flashlight on the bookshelf.',
    ],
  },
  {
    id: 'terminal',
    title: 'Hack the terminal',
    hints: [
      'You found a word. Something in this room is asking for a password.',
      'The terminal is waiting for a password.',
      'Type the password NEURON into the terminal.',
    ],
  },
  {
    id: 'keycard',
    title: 'Retrieve the keycard',
    hints: [
      'The terminal said a lock was released somewhere in the room.',
      'Check the air vent.',
      'Take the keycard from the open vent.',
    ],
  },
  {
    id: 'door',
    title: 'Escape through the door',
    hints: [
      'You already hold everything you need to leave.',
      'The door has a card reader.',
      'Use the keycard on the door.',
    ],
  },
];
