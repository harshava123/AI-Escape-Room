// Campaign levels. Each level is a new room with stricter rules; the engine
// reads these numbers, the generator reads `design` to tune clue difficulty.

export const LEVELS = [
  {
    number: 1,
    title: 'INITIATE',
    timeLimitMs: 15 * 60 * 1000,
    hintCost: 50,
    wrongCost: 20,
    wrongPenaltyMs: 0,
    multiplier: 1,
    design:
      'DIFFICULTY: EASY (level 1 of 3). The riddle should point to the code clue fairly directly. ' +
      'Show the code clearly. Hints are friendly and concrete.',
  },
  {
    number: 2,
    title: 'OPERATIVE',
    timeLimitMs: 12 * 60 * 1000,
    hintCost: 75,
    wrongCost: 30,
    wrongPenaltyMs: 15 * 1000,
    multiplier: 1.5,
    design:
      'DIFFICULTY: MEDIUM (level 2 of 3). The riddle is indirect: it describes the code clue by its purpose or story, not its name. ' +
      'The password lock description gives only a subtle hint about how to see hidden writing.',
  },
  {
    number: 3,
    title: 'MASTERMIND',
    timeLimitMs: 10 * 60 * 1000,
    hintCost: 120,
    wrongCost: 40,
    wrongPenaltyMs: 30 * 1000,
    multiplier: 2,
    design:
      'DIFFICULTY: HARD (level 3 of 3). The riddle is a genuine cryptic puzzle (wordplay or metaphor) that still uniquely identifies the code clue. ' +
      'The code clue description may include other, irrelevant numbers that are NOT 4 digits long, so the player must think. ' +
      'The decoy and its item should look very convincing. The first hint of each stage is vague.',
  },
];

export const TOTAL_LEVELS = LEVELS.length;

export const getLevel = (n) => LEVELS[Math.min(Math.max(1, n), TOTAL_LEVELS) - 1];

// Client-facing summary of a level's rules.
export const publicLevel = (level) => ({
  number: level.number,
  total: TOTAL_LEVELS,
  title: level.title,
  timeLimitMs: level.timeLimitMs,
  hintCost: level.hintCost,
  wrongPenaltyMs: level.wrongPenaltyMs,
  multiplier: level.multiplier,
});
