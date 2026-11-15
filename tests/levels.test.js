import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, TOTAL_LEVELS } from '../src/v2/levels.js';
import { createGame, applyAction, publicState, score } from '../src/v2/engine.js';
import { parseLocal } from '../src/v2/parser.js';
import { classicRoom } from '../src/v2/rooms/classic.js';

delete process.env.GEMINI_API_KEY;
const { startGame, nextLevel, retryLevel, playTurn } = await import('../src/v2/game.js');

const SOLUTIONS = {
  1: ['read the poster', 'examine the clock', 'enter 0745 on the drawer', 'shine the uv light on the bookshelf', 'type neuron into the terminal', 'take the keycard', 'use the keycard on the door'],
  2: ['read the wall carving', 'examine the stone tablet', 'enter 3150 on the stone chest', 'use the scarab lens on the star ceiling', 'type osiris into the sphinx', 'take the golden ankh', 'use the ankh on the tomb door'],
  3: ['read the graffiti', 'read the mission log', 'enter 8317 on the locker', 'use the thermal goggles on the frosted window', 'type aurora into the console', 'take the power fuse', 'use the fuse on the airlock hatch'],
};

test('there are 3 levels and each one is harder', () => {
  assert.equal(TOTAL_LEVELS, 3);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].timeLimitMs < LEVELS[i - 1].timeLimitMs, 'less time');
    assert.ok(LEVELS[i].hintCost > LEVELS[i - 1].hintCost, 'pricier hints');
    assert.ok(LEVELS[i].wrongPenaltyMs >= LEVELS[i - 1].wrongPenaltyMs, 'wrong answers cost time');
    assert.ok(LEVELS[i].multiplier > LEVELS[i - 1].multiplier, 'bigger score multiplier');
  }
});

test('every classic level room is solvable with natural language', () => {
  for (const level of [1, 2, 3]) {
    const room = classicRoom(level);
    const state = createGame(room, Date.now(), { level });
    let last;
    for (const cmd of SOLUTIONS[level]) {
      const action = parseLocal(cmd, room);
      assert.ok(action, `level ${level}: could not parse "${cmd}"`);
      last = applyAction(state, action);
    }
    assert.equal(last.event, 'escaped', `level ${level} did not end in an escape`);
  }
});

test('the three classic levels are different rooms', () => {
  const names = new Set([1, 2, 3].map((l) => classicRoom(l).name));
  assert.equal(names.size, 3);
});

test('level time limits are applied', () => {
  const now = Date.now();
  const state = createGame(classicRoom(3), now, { level: 3 });
  assert.equal(state.deadline - now, LEVELS[2].timeLimitMs);
  assert.equal(publicState(state, now).level.number, 3);
});

test('the clock only starts with the first move', () => {
  const t = Date.now();
  const state = createGame(classicRoom(1), t, { level: 1 });
  assert.equal(publicState(state, t + 60000).timeLeftMs, LEVELS[0].timeLimitMs);
  applyAction(state, { intent: 'look' }, t + 60000);
  assert.equal(state.deadline, t + 60000 + LEVELS[0].timeLimitMs);
  assert.equal(publicState(state, t + 70000).timeLeftMs, LEVELS[0].timeLimitMs - 10000);
});

test('from level 2, a wrong code costs time', () => {
  const state = createGame(classicRoom(2), Date.now(), { level: 2 });
  const before = state.deadline;
  const out = applyAction(state, { intent: 'enter', code: '1111', target: 'lockbox' });
  assert.equal(out.event, 'wrong_code');
  assert.equal(out.penaltyMs, LEVELS[1].wrongPenaltyMs);
  assert.equal(before - state.deadline, LEVELS[1].wrongPenaltyMs);
  assert.match(out.message, /seconds/);
});

test('level 1 has no time penalty', () => {
  const state = createGame(classicRoom(1), Date.now(), { level: 1 });
  const before = state.deadline;
  applyAction(state, { intent: 'enter', code: '1111', target: 'lockbox' });
  assert.equal(state.deadline, before);
});

test('harder levels multiply the score', () => {
  const t = Date.now();
  const scoreAt = (level) => {
    const state = createGame(classicRoom(level), t, { level });
    Object.assign(state, { finishedAt: t + 120000 });
    state.flags.escaped = true;
    return score(state);
  };
  assert.equal(scoreAt(1), 880);
  assert.equal(scoreAt(3), 1760);
});

test('campaign: escape level 1, advance to 2 and 3, total score adds up', async () => {
  let r = await startGame({ mode: 'classic' });
  const { sessionId } = r;
  await assert.rejects(nextLevel(sessionId), /Escape this room/);

  for (const level of [1, 2, 3]) {
    assert.equal(r.campaign.level, level);
    assert.equal(r.state.level.number, level);
    for (const cmd of SOLUTIONS[level]) r = await playTurn(sessionId, cmd);
    assert.equal(r.state.status, 'escaped');
    if (level < 3) r = await nextLevel(sessionId);
  }

  assert.equal(r.campaign.complete, true);
  assert.equal(r.campaign.scores.length, 3);
  assert.equal(r.campaign.totalScore, r.campaign.scores.reduce((a, b) => a + b, 0));
  assert.ok(r.state.achievements.some((a) => a.id === 'campaign'));
  await assert.rejects(nextLevel(sessionId), /every level/);
});

test('retry restarts the current level with a fresh clock', async () => {
  const r = await startGame({ mode: 'classic' });
  await playTurn(r.sessionId, 'enter 1111 on the drawer');
  const again = retryLevel(r.sessionId);
  assert.equal(again.state.level.number, 1);
  assert.equal(again.state.wrongAttempts, 0);
  assert.equal(again.state.moves, 0);
});
