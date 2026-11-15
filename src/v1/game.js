// Version 1 - "the LLM is the whole game".
// The model receives the full room description *including the solutions* and
// the entire conversation history, and decides on its own whether the player
// has escaped. Simple to build, but see README "Problems found in Version 1".

const SYSTEM_PROMPT = `You are the game master of a text escape room called "Room 404: The Forgotten Lab".
The player wakes up locked inside an abandoned AI research lab and must escape.

The room contains:
- A heavy steel door with a keycard reader. It opens only with the keycard.
- A wall clock whose hands are frozen at 7:45.
- A faded poster: "TIME REVEALS ALL - the moment everything stopped is your key."
- A metal desk with a locked drawer that has a 4-digit keypad. The code is 0745.
  Inside the drawer is a UV flashlight.
- A bookshelf. Shining the UV flashlight on it reveals the word NEURON painted on the back panel.
- An old terminal asking for a password. The password is NEURON. When entered, it releases the vent lock.
- An air vent, electronically locked. After the terminal is unlocked, the vent opens and contains the keycard.
- A dried potted plant with a rusty key buried in it. The rusty key does not open anything.

Rules:
- Describe the room and the results of the player's actions in a spooky, atmospheric way.
- Do not reveal the solutions directly.
- Keep track of the player's inventory.
- When the player opens the door with the keycard, congratulate them and write [ESCAPED].`;

const sessions = new Map();

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId);
}

export function resetV1(sessionId) {
  sessions.delete(sessionId);
}

export async function chatV1(sessionId, message) {
  const history = getHistory(sessionId);
  history.push({ role: 'user', parts: [{ text: message }] });

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY || '',
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: history,
    }),
  });

  const data = await res.json();
  const reply = data.candidates[0].content.parts[0].text;

  history.push({ role: 'model', parts: [{ text: reply }] });

  return {
    reply: reply.replace('[ESCAPED]', '').trim(),
    escaped: reply.includes('[ESCAPED]'),
    turns: history.length / 2,
  };
}
