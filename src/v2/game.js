// Orchestrates games and turns.
//   new game: (AI mode) Gemini designs a room -> validateRoom -> fallback to classic room
//   turn:     sanitize -> injection check -> parse (local, then Gemini) -> engine -> narrate -> output guard

import { createGame, applyAction, getHint, publicState, recordInjectionAttempt } from './engine.js';
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

export async function startGame({ mode = 'classic' } = {}) {
  let room;
  let notice = null;
  const started = Date.now();

  if (mode === 'ai') {
    if (!geminiConfigured()) {
      notice = 'No GEMINI_API_KEY configured - loading the classic room instead.';
    } else {
      try {
        room = await generateRoom();
      } catch (err) {
        console.warn('[v2] room generation failed:', err.message);
        notice = 'ECHO could not build a valid new room this time - loading the classic room instead.';
      }
    }
  }
  room ??= classicRoom();

  const state = createGame(room);
  const sessionId = createSession(state);
  return {
    sessionId,
    narration: room.intro,
    event: 'intro',
    notice,
    state: publicState(state),
    ai: { enabled: geminiConfigured(), generated: room.aiGenerated, generationMs: Date.now() - started },
  };
}

function requireSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new GameError('Game session not found or expired. Start a new game.', 404);
  return session;
}

export async function playTurn(sessionId, rawInput) {
  const started = Date.now();
  const { state } = requireSession(sessionId);
  const { room } = state;
  const meta = { parser: 'none', narrator: 'engine', guard: 'passed', aiError: null };

  const clean = sanitizeInput(rawInput);
  if (!clean.ok) throw new GameError(clean.error, 400);
  const input = clean.text;

  if (detectInjection(input)) {
    const outcome = recordInjectionAttempt(state);
    meta.guard = 'input_blocked';
    return finish(state, outcome, outcome.message, meta, started);
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

  return finish(state, outcome, narration, meta, started, action);
}

export function takeHint(sessionId) {
  const { state } = requireSession(sessionId);
  const outcome = getHint(state);
  return finish(state, { ...outcome, achievements: [] }, outcome.message, { parser: 'none', narrator: 'engine', guard: 'passed' }, Date.now());
}

function finish(state, outcome, narration, meta, started, action = null) {
  if (meta.aiError) console.warn('[v2] Gemini fallback:', meta.aiError);
  return {
    narration,
    event: outcome.event,
    success: outcome.success,
    item: outcome.item || null,
    achievements: outcome.achievements || [],
    state: publicState(state),
    meta: { ...meta, aiError: meta.aiError ? 'fallback_used' : null, action, latencyMs: Date.now() - started },
  };
}
