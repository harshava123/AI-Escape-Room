// AI room generator: Gemini designs a brand-new room for every game.
//
// The server - not the model - picks the 4-digit code and a random theme and
// puzzle style, so every room is different and the code is always well-formed.
// Gemini writes all content to a strict JSON schema, and validateRoom() checks
// that the room is solvable and keeps its secrets before anyone plays it.

import crypto from 'node:crypto';
import { generate, roomModel } from './gemini.js';
import { OBJECT_ROLES, ITEM_ROLES, HINT_STAGES, ICONS, validateRoom } from './room-format.js';
import { getLevel } from './levels.js';

const THEMES = [
  'an abandoned lighthouse during a storm', "a pirate captain's cabin on a sinking ship", 'a pharaoh\'s sealed burial chamber',
  'the med-bay of a drifting space station', 'a haunted Victorian library', "a wizard's tower study", 'a submarine control room',
  "a 1920s detective's office", 'an arctic research base during a blizzard', "a cyberpunk hacker's den", 'a medieval castle dungeon',
  "a toymaker's workshop at midnight", 'a greenhouse dome on a Mars colony', 'the backstage of a 1930s jazz club',
  'a jungle temple of a lost civilization', 'a sleeper car on a night train', "a mad scientist's basement laboratory",
  'a museum vault after closing time', 'the ruins of an underwater city', 'a samurai dojo at dawn', 'a carnival funhouse',
  "an alchemist's cellar", 'an abandoned subway station', 'a mountain observatory', 'a Viking chieftain\'s longhouse',
  "a time traveler's garage", "a sleeping dragon's treasure cave", 'a Cold War spy safehouse', 'a chocolate factory after hours',
  'a ghost ship\'s cargo hold', 'a royal clockmaker\'s workshop', 'a radio station broadcasting from the end of the world',
];

const CODE_CLUE_STYLES = [
  'a clock, watch or timer frozen at a specific time',
  'a date written, carved or circled somewhere',
  'a serial number, label or plate on an object',
  'a page, chapter or catalogue number',
  'a reading on a gauge, dial or instrument',
  'a year engraved on a plaque, coin or portrait',
  'a combination scratched or chalked on a surface',
];

const REVEAL_STYLES = [
  'ultraviolet or black light revealing invisible ink',
  'a magnifying lens revealing microscopic writing',
  'a special tinted lens or goggles revealing a hidden layer',
  'heat from a candle or lamp revealing lemon-juice writing',
  'a decoder strip or stencil placed over a pattern of letters',
  'a reflection in a mirror revealing reversed writing',
  'a damp cloth or brush revealing letters under dust or soot',
];

const recentThemes = [];

const pick = (list) => list[crypto.randomInt(list.length)];

function pickTheme() {
  const options = THEMES.filter((t) => !recentThemes.includes(t));
  const theme = pick(options.length ? options : THEMES);
  recentThemes.push(theme);
  if (recentThemes.length > 8) recentThemes.shift();
  return theme;
}

const entity = (withDescription = true) => ({
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    aliases: { type: 'ARRAY', items: { type: 'STRING' } },
    icon: { type: 'STRING', enum: ICONS },
    ...(withDescription ? { description: { type: 'STRING' } } : {}),
  },
  required: ['name', 'aliases', 'icon', 'description'],
});

const ROOM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    intro: { type: 'STRING' },
    escapeText: { type: 'STRING' },
    password: { type: 'STRING' },
    objects: { type: 'OBJECT', properties: Object.fromEntries(OBJECT_ROLES.map((r) => [r, entity()])), required: OBJECT_ROLES },
    items: { type: 'OBJECT', properties: Object.fromEntries(ITEM_ROLES.map((r) => [r, entity()])), required: ITEM_ROLES },
    hints: {
      type: 'OBJECT',
      properties: Object.fromEntries(HINT_STAGES.map((s) => [s, { type: 'ARRAY', items: { type: 'STRING' } }])),
      required: HINT_STAGES,
    },
  },
  required: ['name', 'intro', 'escapeText', 'password', 'objects', 'items', 'hints'],
};

const SYSTEM = `You are a professional escape-room designer. You design one self-contained room for a text escape game.
The puzzle LOGIC is fixed and enforced by a game engine. You invent all the CONTENT: setting, objects, items, clues, password and hints.
Be creative, specific and atmospheric. Every room must feel new - avoid generic labs, clocks and keycards unless the setting demands them.

The fixed puzzle chain, by role:
1. codeClue: an object whose description visibly shows the 4-digit CODE you are given, in a form that fits the setting.
   Its description MUST contain the code's digits in order (for 0745 you may write "0745", "07:45" or "07/45").
2. riddle: an object with a cryptic message telling the player WHICH object holds the code. Never write the digits here.
3. lockbox: a container sealed by a 4-digit keypad or combination lock. Do not say what is inside.
4. tool (item): found inside the lockbox. It reveals hidden writing when used on the revealSurface.
5. revealSurface: a surface hiding the PASSWORD invisibly. Hint that something is hidden, but never write the password.
6. passwordLock: a device or lock that asks for a password. Its description gives a subtle hint about where hidden writing is and how to see it.
7. compartment: a sealed place that unlocks when the password is entered. It holds the exitKey.
8. exitKey (item): the only thing that opens the exit.
9. exit: the way out of the room.
Extra: furniture is a purely atmospheric object (no clues). decoy is an object hiding the decoyItem, a tempting red herring that opens nothing.

Rules:
- Every object and item name is unique, 1-3 words, lowercase except proper nouns.
- aliases: 2-4 short lowercase nouns a player might type for that thing; never shared between things.
- descriptions: 1-3 sentences, at most 300 characters, written in second person present tense.
- PASSWORD: one word of 5-8 letters that fits the setting, written in UPPERCASE in the password field ONLY. It must not appear in any other text, including names, aliases and hints.
- The CODE must appear ONLY in codeClue.description. Never in hints, the intro or other text.
- intro: 2-4 sentences setting the scene and naming the visible objects (do not mention items that are hidden).
- escapeText: 1-2 triumphant sentences describing what happens as the exit opens.
- hints: exactly 2 per stage, first vague then more specific, no digits of the code and no letters of the password.
  Stages: lockbox (find and use the code), reveal (use the tool on the revealSurface), passwordLock (enter the revealed word), exitKey (get the exitKey from the compartment), exit (use exitKey on exit).
- icon: choose the closest icon from the allowed list for each thing.
- Family friendly. Output only the JSON.`;

export async function generateRoom({ attempts = 3, level = 1 } = {}) {
  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  const theme = pickTheme();
  const clueStyle = pick(CODE_CLUE_STYLES);
  const revealStyle = pick(REVEAL_STYLES);
  const { design } = getLevel(level);

  let feedback = '';
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const prompt =
      `Design a new escape room.\nSetting: ${theme}\nCODE: ${code}\n` +
      `Suggested code clue style: ${clueStyle}\nSuggested reveal mechanic: ${revealStyle}\n${design}\n` +
      `Make the names, items and password specific to this setting.` +
      feedback;

    try {
      const raw = await generate({
        system: SYSTEM,
        prompt,
        schema: ROOM_SCHEMA,
        temperature: 1.0,
        maxOutputTokens: 8192,
        thinking: 'low',
        timeoutMs: 90000,
        retries: 1,
        model: roomModel(),
      });
      return validateRoom({ ...raw, theme, aiGenerated: true, id: `ai-${level}-${Date.now()}` }, { code });
    } catch (err) {
      lastError = err;
      if (err.errors) {
        feedback = `\n\nYour previous design was rejected for these reasons - fix all of them:\n- ${err.errors.join('\n- ')}`;
        console.warn(`[generator] level ${level} attempt ${attempt} rejected: ${err.errors.join('; ')}`);
      } else {
        console.warn(`[generator] level ${level} attempt ${attempt} failed: ${err.message.slice(0, 120)}`);
      }
    }
  }
  throw lastError;
}
