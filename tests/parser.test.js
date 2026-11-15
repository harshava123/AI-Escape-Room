import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocal } from '../src/v2/parser.js';
import { validateAction } from '../src/v2/ai.js';
import { classicRoom } from '../src/v2/rooms/classic.js';

const room = classicRoom();

const cases = [
  ['look around', { intent: 'look' }],
  ['Examine the CLOCK!', { intent: 'examine', target: 'codeClue' }],
  ['punch 0745 into the keypad', { intent: 'enter', code: '0745', target: 'lockbox' }],
  ['shine the uv light at the shelves', { intent: 'use', item: 'tool', target: 'revealSurface' }],
  ['type neuron into the computer', { intent: 'enter', code: 'neuron', target: 'passwordLock' }],
  ['unlock the door with the keycard', { intent: 'use', item: 'exitKey', target: 'exit' }],
  ['swipe card on reader', { intent: 'use', item: 'exitKey', target: 'exit' }],
  ['try the rusty key on the door', { intent: 'use', item: 'decoyItem', target: 'exit' }],
  ['grab key card', { intent: 'take', target: 'exitKey' }],
  ['inventory', { intent: 'inventory' }],
  ["I'm stuck", { intent: 'hint' }],
  ['poster', { intent: 'examine', target: 'riddle' }],
];

for (const [input, expected] of cases) {
  test(`parses "${input}"`, () => {
    const action = parseLocal(input, room);
    assert.ok(action, 'expected a parsed action');
    for (const [k, v] of Object.entries(expected)) assert.equal(action[k], v, `field ${k}`);
  });
}

test('ambiguous or off-topic input returns null so Gemini can try', () => {
  assert.equal(parseLocal('i wonder whether the strange machine has any secrets', room), null);
  assert.equal(parseLocal('dance', room), null);
});

test('validateAction coerces malformed LLM output to a safe action', () => {
  assert.deepEqual(validateAction({ intent: 'teleport', target: 'outside', item: 'laser', code: 42 }), {
    intent: 'unknown',
    target: 'none',
    item: 'none',
    code: '',
  });
  assert.equal(validateAction(null).intent, 'unknown');
  assert.equal(validateAction({ intent: 'enter', code: 'x'.repeat(100) }).code.length, 20);
});
