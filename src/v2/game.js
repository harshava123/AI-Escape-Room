// Orchestrates campaigns, levels and turns.
//   new game:   level 1 room: (AI mode) Gemini designs it -> validateRoom -> fallback to classic room
//   next level: after an escape, the next (harder) room - in AI mode pre-generated in the background
//   turn:       sanitize -> injection check -> parse (local, then Gemini) -> engine -> narrate -> output guard

import { createGame, applyAction, getHint, publicState, recordInjectionAttempt, status, score } from './engine.js';
import { TOTAL_LEVELS } from './levels.js';
import { parseLocal } from './parser.js';
import { parseWithGemini, narrate } from './ai.js';
import { sanitizeInput, detectInjection, checkNarration } from './guard.js';
import { geminiConfigured } from './gemini.js';
import { generateRoom } from './generator.js';
import { classicRoom } from './rooms/classic.js';
import { createSession, getSession } from './sessions.js';

// Engine messages for these events are already precise; rephrasing adds risk, not value.
const SKIP_NARRATION = new Set(['inventory', 'help', 'hint', 'game_over', 'noop']);

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function loadRoom(mode, level, pending = null) {
  if (mode !== 'ai') return { room: classicRoom(level), notice: null };
  if (!geminiConfigured()) return { room: classicRoom(level), notice: 'No GEMINI_API_KEY configured - loading the classic room instead.' };
  try {
    return { room: await (pending ?? generateRoom({ level })), notice: null };
  } catch (err) {
    console.warn(`[v2] room generation for level ${level} failed:`, err.message);
    return { room: classicRoom(level), notice: 'ECHO could not build a valid new room this time - loading the classic room instead.' };
  }
}

// Starts designing the next level's room while the player solves the current one.
function prefetchNext(session) {
  const next = session.state.level.number + 1;
  session.pending = null;
  if (session.mode !== 'ai' || !geminiConfigured() || next > TOTAL_LEVELS) return;
  session.pending = generateRoom({ level: next });
  session.pending.catch(() => {});
}

// Records the score of an escaped level and returns the run summary for the client.
function campaignView(session) {
  const { state } = session;
  const idx = state.level.number - 1;
  if (status(state) === 'escaped' && session.scores[idx] === undefined) session.scores[idx] = score(state);
  const scores = session.scores.slice(0, TOTAL_LEVELS);
  return {
    mode: session.mode,
    level: state.level.number,
    total: TOTAL_LEVELS,
    scores,
    totalScore: scores.reduce((sum, s) => sum + (s || 0), 0),
    complete: scores.length === TOTAL_LEVELS && scores.every((s) => s !== undefined),
  };
}

function levelResponse(sessionId, session, { notice = null, started = Date.now() } = {}) {
  const { state } = session;
  return {
    sessionId,
    narration: state.room.intro,
    event: 'intro',
    notice,
    state: publicState(state),
    campaign: campaignView(session),
    ai: { enabled: geminiConfigured(), generated: state.room.aiGenerated, generationMs: Date.now() - started },
  };
}

export async function startGame({ mode = 'classic' } = {}) {
  const started = Date.now();
  const { room, notice } = await loadRoom(mode, 1);
  const sessionId = createSession(createGame(room, Date.now(), { level: 1 }), { mode, scores: [], pending: null });
  const session = getSession(sessionId);
  prefetchNext(session);
  return levelResponse(sessionId, session, { notice, started });
}

export async function nextLevel(sessionId, { classic = false } = {}) {
  const session = requireSession(sessionId);
  const from = session.state;
  if (status(from) !== 'escaped') throw new GameError('Escape this room before moving on.', 409);
  const level = from.level.number + 1;
  if (level > TOTAL_LEVELS) throw new GameError('You already escaped every level. Start a new run.', 409);
  campaignView(session);

  const started = Date.now();
  const pending = session.pending;
  session.pending = null;
  const { room, notice } = await loadRoom(classic ? 'classic' : session.mode, level, classic ? null : pending);

  // Another request (e.g. "play classic instead") may have advanced the run while we waited.
  if (session.state !== from) return levelResponse(sessionId, session, { started });

  session.state = createGame(room, Date.now(), { level, achievements: from.achievements });
  prefetchNext(session);
  return levelResponse(sessionId, session, { notice, started });
}

// Replays the current level's room from scratch after running out of time.
export function retryLevel(sessionId) {
  const session = requireSession(sessionId);
  const from = session.state;
  if (status(from) === 'escaped') throw new GameError('You already escaped this room.', 409);
  session.state = createGame(from.room, Date.now(), { level: from.level.number, achievements: from.achievements });
  return levelResponse(sessionId, session);
}

function requireSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new GameError('Game session not found or expired. Start a new game.', 404);
  return session;
}

export async function playTurn(sessionId, rawInput) {
  const started = Date.now();
  const session = requireSession(sessionId);
  const { state } = session;
  const { room } = state;
  const meta = { parser: 'none', narrator: 'engine', guard: 'passed', aiError: null };

  const clean = sanitizeInput(rawInput);
  if (!clean.ok) throw new GameError(clean.error, 400);
  const input = clean.text;

  if (detectInjection(input)) {
    const outcome = recordInjectionAttempt(state);
    meta.guard = 'input_blocked';
    return finish(session, outcome, outcome.message, meta, started);
  }

  let action = parseLocal(input, room);
  if (action) meta.parser = 'local';
  else if (geminiConfigured()) {
    try {
      action = await parseWithGemini(input, room);
      meta.parser = 'gemini';
    } catch (err) {
      meta.aiError = err.message;
    }
  }
  if (!action) action = { intent: 'unknown', target: 'none', item: 'none', code: '' };

  const outcome = applyAction(state, action);
  let narration = outcome.message;

  if (geminiConfigured() && !SKIP_NARRATION.has(outcome.event)) {
    try {
      const candidate = await narrate({ input, outcome, room });
      const verdict = checkNarration(candidate, { canonical: outcome.message, event: outcome.event, known: state.known, room });
      if (verdict.ok) {
        narration = candidate;
        meta.narrator = 'gemini';
      } else {
        meta.guard = `output_rejected:${verdict.reason}`;
      }
    } catch (err) {
      meta.aiError = err.message;
    }
  }

  return finish(session, outcome, narration, meta, started, action);
}

export function takeHint(sessionId) {
  const session = requireSession(sessionId);
  const outcome = getHint(session.state);
  return finish(session, { ...outcome, achievements: [] }, outcome.message, { parser: 'none', narrator: 'engine', guard: 'passed' }, Date.now());
}

function finish(session, outcome, narration, meta, started, action = null) {
  if (meta.aiError) console.warn('[v2] Gemini fallback:', meta.aiError);
  return {
    narration,
    event: outcome.event,
    success: outcome.success,
    item: outcome.item || null,
    penaltyMs: outcome.penaltyMs || 0,
    achievements: outcome.achievements || [],
    state: publicState(session.state),
    campaign: campaignView(session),
    meta: { ...meta, aiError: meta.aiError ? 'fallback_used' : null, action, latencyMs: Date.now() - started },
  };
}
