import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRoom, publicRoom, codePattern } from '../src/v2/room-format.js';
import { createGame, applyAction, publicState } from '../src/v2/engine.js';
import { parseLocal } from '../src/v2/parser.js';
import { classicRoom } from '../src/v2/rooms/classic.js';

const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/ai-room-detective.json', import.meta.url), 'utf8'));
const CODE = '5924';

test('classic room passes validation', () => {
  assert.equal(classicRoom().name, 'Room 404: The Forgotten Lab');
});

test('a real Gemini-generated room passes validation', () => {
  const room = validateRoom(fixture(), { code: CODE });
  assert.equal(room.password, 'FALCON');
  assert.ok(room.objects.codeClue.aliases.includes('compass'));
});

test('a generated room is fully playable with natural language', () => {
  const room = validateRoom(fixture(), { code: CODE });
  const state = createGame(room);
  const commands = [
    'read the parchment',
    'examine the compass',
    'enter 5924 on the safe',
    'use the red monocle on the filing cabinet',
    'type falcon into the cipher wheel',
    'take the skeleton key',
    'unlock the door with the key',
  ];
  let last;
  for (const cmd of commands) {
    const action = parseLocal(cmd, room);
    assert.ok(action, `could not parse "${cmd}"`);
    last = applyAction(state, action);
  }
  assert.equal(last.event, 'escaped');
});

test('rejects a room whose code clue does not contain the code', () => {
  const raw = fixture();
  raw.objects.codeClue.description = 'A heavy nautical brass compass with a cracked glass face.';
  assert.throws(() => validateRoom(raw, { code: CODE }), /codeClue.description must contain/);
});

test('rejects a room that leaks the password outside the reveal mechanic', () => {
  const raw = fixture();
  raw.hints.passwordLock[1] = 'Enter FALCON into the cipher wheel.';
  assert.throws(() => validateRoom(raw, { code: CODE }), /password appears/);
});

test('rejects a room that leaks the code in a hint', () => {
  const raw = fixture();
  raw.hints.lockbox[0] = 'Try 5-9-2-4 on the safe.';
  assert.throws(() => validateRoom(raw, { code: CODE }), /code appears outside/);
});

test('rejects malformed rooms and lists every problem', () => {
  try {
    validateRoom({ name: '', password: 'two words', objects: {}, items: {}, hints: {} }, { code: '12' });
    assert.fail('expected an error');
  } catch (err) {
    assert.ok(err.errors.length > 10);
  }
});

test('strips markup from model output and drops duplicate aliases', () => {
  const raw = fixture();
  raw.objects.furniture.name = 'mahogany <script>desk</script>';
  raw.objects.decoy.aliases.push('door');
  const room = validateRoom(raw, { code: CODE });
  assert.doesNotMatch(room.objects.furniture.name, /[<>]/);
  assert.ok(!room.objects.decoy.aliases.includes('door'));
});

test('public room and state contain no code or password', () => {
  const room = validateRoom(fixture(), { code: CODE });
  const json = JSON.stringify({ room: publicRoom(room), state: publicState(createGame(room)) });
  assert.doesNotMatch(json, /falcon/i);
  assert.doesNotMatch(json, codePattern(CODE));
});
