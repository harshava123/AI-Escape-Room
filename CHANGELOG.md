# Changelog

## [2.2.0] - 3-level campaign

### Added
- A run is now **3 levels**. Each level is a new room with stricter rules (`src/v2/levels.js`): less time (15, 12, then 10 minutes), higher hint costs (50, 75, 120), a time penalty for wrong codes from level 2 (15 s, then 30 s), and a score multiplier (x1, x1.5, x2).
- Two new hand-made rooms for the classic campaign: **The Pharaoh's Tomb** and **Station Zero**, beside Room 404.
- AI rooms get a difficulty brief per level, so later riddles are genuinely cryptic.
- The next AI room is generated in the background during the current level.
- UI: level pips, a run-score counter, a level-intro card, and end screens for level cleared, campaign complete and timeout (next level, retry, or a new run).
- The countdown starts with the first move, not while the intro is on screen.
- Achievements carry across the run. New ones: Flawless and Mastermind.
- 11 new tests (49 total), including a full classic campaign played through the API.

### Changed
- Default model is `gemini-3.5-flash-lite`, which has a much larger free-tier daily quota. `GEMINI_ROOM_MODEL` can point room design at a different model.
- Room generation retries up to 3 times and retries transient API errors, then falls back to that level's classic room.

## [2.1.0] - AI-generated rooms

### Added
- **AI room generator** (`src/v2/generator.js`): Gemini designs a brand-new room every game (setting, objects, riddle, clue, reveal mechanic, items, password, hints) using a JSON response schema.
- Randomness from the server: a 4-digit code (`crypto.randomInt`), 32 settings, 7 code-clue styles and 7 reveal mechanics, avoiding recently used settings.
- Room validation (`src/v2/room-format.js`): checks that the room is solvable and keeps its secrets (no leaked code or password, unique names and aliases, markup stripped). An invalid design is retried once with feedback, then the game falls back to the classic room.
- UI: mode choice (**GENERATE NEW ROOM** / **CLASSIC**), a room-construction screen with a cancel option, dynamic room header, hotspots and icons for generated objects.
- `npm run playtest`: generates a live AI room and plays it to the end through the HTTP API.
- 9 new tests (38 total), including a full playthrough of a real Gemini-generated room fixture.

### Changed
- The engine, parser, guards and AI prompts are role-based and work with any validated room. The classic room moved to `src/v2/rooms/classic.js`.
- The default model is now `gemini-3.5-flash` (`gemini-2.5-flash` returns 404 for new API keys). The thinking configuration adapts to the model generation.
- Narration fails fast (7 s, no retry) and falls back to engine text, so slow API responses no longer stall a turn.

## [2.0.0] - Engine + AI narrator

### Added
- Deterministic game engine (`src/v2/engine.js`) as the single source of truth for state and rules.
- Room definition with puzzle stages, tiered hints and server-only secrets (`src/v2/room.js`).
- Rule-based local parser for common commands, with zero API calls (`src/v2/parser.js`).
- Gemini parser using a JSON response schema for ambiguous input, plus validation of model output (`src/v2/ai.js`).
- Gemini narrator that only rephrases engine outcomes and never sees solutions.
- Input guard (sanitizing, length limit, injection detection) and output guard (secret leaks, false escapes, dropped facts) (`src/v2/guard.js`).
- Gemini client with timeout, retry with backoff and empty-reply detection (`src/v2/gemini.js`).
- Offline mode: the game is fully playable without an API key.
- Session store with TTL and per-IP rate limiting (`src/v2/sessions.js`).
- Server hardening: body size limit, JSON validation, central error handling, `/api/health`.
- New game UI: boot sequence, room hotspots, keypad, password terminal, inventory, objectives, timer,
  hints, scoring, achievements, CRT and glitch effects, particles, confetti and Web Audio sound effects.
- 29 automated tests (`npm test`) and documented test cases (`docs/TEST_CASES.md`).

### Changed
- Version select landing page restyled. Version 1 is kept unchanged for comparison.

## [1.0.0] - LLM-only game master

### Added
- Node.js HTTP server serving static files and a chat endpoint.
- Single system prompt containing the room, puzzles and solutions; full chat history sent each turn.
- Win detection by searching the reply for `[ESCAPED]`.
- Basic chat UI.

### Known issues (fixed in 2.0.0)
- Solutions can be leaked through prompt injection.
- The model can accept invalid actions and wrong answers, or be talked into a win.
- State drifts in long sessions; token cost grows every turn.
- Any Gemini API error crashes the server.
