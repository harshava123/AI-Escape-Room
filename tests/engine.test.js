import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, getHint, publicState, score } from '../src/v2/engine.js';
import { classicRoom } from '../src/v2/rooms/classic.js';

const act = (intent, extra = {}) => ({ intent, target: 'none', item: 'none', code: '', ...extra });

function solve(state, now) {
  applyAction(state, act('enter', { code: state.room.code, target: 'lockbox' }), now);
  applyAction(state, act('use', { item: 'tool', target: 'revealSurface' }), now);
  applyAction(state, act('enter', { code: state.room.password.toLowerCase(), target: 'passwordLock' }), now);
  applyAction(state, act('take', { target: 'exitKey' }), now);
  return applyAction(state, act('use', { item: 'exitKey', target: 'exit' }), now);
}

test('happy path escapes and unlocks achievements', () => {
  const now = Date.now();
  const state = createGame(classicRoom(), now);
  const out = solve(state, now + 60_000);
  assert.equal(out.event, 'escaped');
  assert.equal(publicState(state, now + 60_000).status, 'escaped');
  assert.ok(state.achievements.includes('no_hints'));
  assert.ok(state.achievements.includes('speedrun'));
  assert.ok(score(state) > 800);
});

test('cannot use an item the player does not have (no skipping steps)', () => {
  const state = createGame(classicRoom());
  const out = applyAction(state, act('use', { item: 'exitKey', target: 'exit' }));
  assert.equal(out.event, 'missing_item');
  assert.equal(state.flags.escaped, false);
});

test('wrong code is rejected and counted', () => {
  const state = createGame(classicRoom());
  const out = applyAction(state, act('enter', { code: '1234', target: 'lockbox' }));
  assert.equal(out.event, 'wrong_code');
  assert.equal(state.wrongAttempts, 1);
  assert.equal(state.flags.lockboxOpen, false);
});

test('red herring item never opens the exit', () => {
  const state = createGame(classicRoom());
  applyAction(state, act('take', { target: 'decoyItem' }));
  const out = applyAction(state, act('use', { item: 'decoyItem', target: 'exit' }));
  assert.equal(out.event, 'red_herring');
  assert.equal(state.flags.escaped, false);
  assert.ok(state.achievements.includes('red_herring'));
});

test('exit key is not available before the password lock is solved', () => {
  const state = createGame(classicRoom());
  const out = applyAction(state, act('take', { target: 'exitKey' }));
  assert.equal(out.event, 'unknown_target');
  assert.equal(state.inventory.includes('exitKey'), false);
});

test('password check is case-insensitive but exact', () => {
  const state = createGame(classicRoom());
  applyAction(state, act('enter', { code: 'neurons', target: 'passwordLock' }));
  assert.equal(state.flags.passwordUnlocked, false);
  applyAction(state, act('enter', { code: 'NeUrOn', target: 'passwordLock' }));
  assert.equal(state.flags.passwordUnlocked, true);
});

test('hints escalate per stage, the last one is generated from room data', () => {
  const state = createGame(classicRoom());
  const h1 = getHint(state);
  const h2 = getHint(state);
  const h3 = getHint(state);
  const h4 = getHint(state);
  assert.notEqual(h1.message, h2.message);
  assert.match(h3.message, /0745/);
  assert.equal(h4.message, h3.message);
  assert.equal(state.hintsUsed, 4);
  assert.ok(state.known.includes('code'));
});

test('actions after the timer expires are refused', () => {
  const now = Date.now();
  const state = createGame(classicRoom(), now);
  const out = applyAction(state, act('enter', { code: '0745', target: 'lockbox' }), now + 16 * 60 * 1000);
  assert.equal(out.event, 'timeout');
  assert.equal(state.flags.lockboxOpen, false);
});

test('public state never exposes solutions', () => {
  const state = createGame(classicRoom());
  const json = JSON.stringify(publicState(state));
  assert.doesNotMatch(json, /0745|neuron/i);
});
