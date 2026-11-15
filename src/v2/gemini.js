// Minimal Gemini REST client with timeout, retry and structured-output support.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

export function geminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash';
}

export function geminiConfigured() {
  const key = process.env.GEMINI_API_KEY || '';
  return key.length > 10 && !key.startsWith('your-');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Models that rejected thinkingLevel "minimal"; they get "low" instead.
const noMinimalThinking = new Set();

// Gemini 2.5 models take a token budget; newer models take a thinking level.
function thinkingConfig(model, thinking) {
  if (/gemini-2\.5/.test(model)) {
    if (/pro/.test(model)) return undefined;
    return { thinkingBudget: thinking === 'off' ? 0 : 1024 };
  }
  return { thinkingLevel: thinking === 'off' && !noMinimalThinking.has(model) ? 'minimal' : 'low' };
}

export async function generate({
  system,
  prompt,
  schema,
  temperature = 0.7,
  maxOutputTokens = 1024,
  thinking = 'off',
  timeoutMs = 10000,
  retries = 1,
}) {
  if (!geminiConfigured()) throw new GeminiError('GEMINI_API_KEY is not configured', 0);

  const model = geminiModel();
  const generationConfig = { temperature, maxOutputTokens };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }
  const buildBody = () => {
    const tc = thinkingConfig(model, thinking);
    return JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: tc ? { ...generationConfig, thinkingConfig: tc } : generationConfig,
    });
  };
  let body = buildBody();

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (res.status === 400 && /thinking level/i.test(detail) && !noMinimalThinking.has(model)) {
          noMinimalThinking.add(model);
          body = buildBody();
          attempt--;
          continue;
        }
        throw new GeminiError(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '';
      if (!text.trim()) {
        const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'EMPTY';
        throw new GeminiError(`Gemini returned no text (${reason})`, 200);
      }
      return schema ? JSON.parse(text) : text.trim();
    } catch (err) {
      lastError = err.name === 'AbortError' ? new GeminiError(`Gemini timed out after ${timeoutMs}ms`, 408) : err;
      const retryable = !(lastError instanceof GeminiError) || [408, 429, 500, 502, 503, 504].includes(lastError.status);
      if (!retryable || attempt === retries) break;
      await sleep(800 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
