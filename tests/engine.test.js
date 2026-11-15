import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, getHint, publicState, score } from '../src/v2/engine.js';

const act = (intent, extra = {}) => ({ intent, target: 'none', item: 'none', code: '', ...extra });

function solve(state, now) {
  applyAction(state, act('enter', { code: '0745', target: 'drawer' }), now);
  applyAction(state, act('use', { item: 'uv_flashlight', target: 'bookshelf' }), now);
  applyAction(state, act('enter', { code: 'neuron', target: 'terminal' }), now);
  applyAction(state, act('take', { target: 'keycard' }), now);
  return applyAction(state, act('use', { item: 'keycard', target: 'door' }), now);
}

test('happy path escapes and unlocks achievements', () => {
  const now = Date.now();
  const state = createGame(now);
  const out = solve(state, now + 60_000);
  assert.equal(out.event, 'escaped');
  assert.equal(publicState(state, now + 60_000).status, 'escaped');
  assert.ok(state.achievements.includes('no_hints'));
  assert.ok(state.achievements.includes('speedrun'));
  assert.ok(score(state) > 800);
});

test('cannot use an item the player does not have (no skipping steps)', () => {
  const state = createGame();
  const out = applyAction(state, act('use', { item: 'keycard', target: 'door' }));
  assert.equal(out.event, 'missing_item');
  assert.equal(state.flags.escaped, false);
});

test('wrong drawer code is rejected and counted', () => {
  const state = createGame();
  const out = applyAction(state, act('enter', { code: '1234', target: 'drawer' }));
  assert.equal(out.event, 'wrong_code');
  assert.equal(state.wrongAttempts, 1);
  assert.equal(state.flags.drawerOpen, false);
});

test('red herring rusty key never opens the door', () => {
  const state = createGame();
  applyAction(state, act('take', { target: 'rusty_key' }));
  const out = applyAction(state, act('use', { item: 'rusty_key', target: 'door' }));
  assert.equal(out.event, 'red_herring');
  assert.equal(state.flags.escaped, false);
  assert.ok(state.achievements.includes('red_herring'));
});

test('keycard is not available before the terminal is unlocked', () => {
  const state = createGame();
  const out = applyAction(state, act('take', { target: 'keycard' }));
  assert.equal(out.event, 'unknown_target');
  assert.equal(state.inventory.includes('keycard'), false);
});

test('password check is case-insensitive but exact', () => {
  const state = createGame();
  applyAction(state, act('enter', { code: 'neurons', target: 'terminal' }));
  assert.equal(state.flags.terminalUnlocked, false);
  applyAction(state, act('enter', { code: 'NeUrOn', target: 'terminal' }));
  assert.equal(state.flags.terminalUnlocked, true);
});

test('hints escalate per stage and are tracked', () => {
  const state = createGame();
  const h1 = getHint(state);
  const h2 = getHint(state);
  const h3 = getHint(state);
  const h4 = getHint(state);
  assert.notEqual(h1.message, h2.message);
  assert.match(h3.message, /0745/);
  assert.equal(h4.message, h3.message);
  assert.equal(state.hintsUsed, 4);
  assert.ok(state.known.includes('drawerCode'));
});

test('actions after the timer expires are refused', () => {
  const now = Date.now();
  const state = createGame(now);
  const out = applyAction(state, act('enter', { code: '0745', target: 'drawer' }), now + 16 * 60 * 1000);
  assert.equal(out.event, 'timeout');
  assert.equal(state.flags.drawerOpen, false);
});

test('public state never exposes solutions', () => {
  const state = createGame();
  const json = JSON.stringify(publicState(state));
  assert.doesNotMatch(json, /0745|neuron/i);
});
