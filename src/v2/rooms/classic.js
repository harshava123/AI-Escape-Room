// The hand-made "Room 404" expressed in the shared room format.
// Used when the player picks Classic mode, when no API key is set,
// or when an AI-generated room fails validation.

import { validateRoom } from '../room-format.js';

const CLASSIC = {
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

export const classicRoom = () => validateRoom(CLASSIC);
