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
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export function geminiConfigured() {
  const key = process.env.GEMINI_API_KEY || '';
  return key.length > 10 && !key.startsWith('your-');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function generate({ system, prompt, schema, temperature = 0.7, timeoutMs = 10000, retries = 1 }) {
  if (!geminiConfigured()) throw new GeminiError('GEMINI_API_KEY is not configured', 0);

  const model = geminiModel();
  const generationConfig = { temperature, maxOutputTokens: 1024 };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }
  // 2.5 Flash "thinks" by default, which adds latency and eats the token budget.
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });

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
        throw new GeminiError(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (!text.trim()) {
        const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'EMPTY';
        throw new GeminiError(`Gemini returned no text (${reason})`, 200);
      }
      return schema ? JSON.parse(text) : text.trim();
    } catch (err) {
      lastError = err.name === 'AbortError' ? new GeminiError(`Gemini timed out after ${timeoutMs}ms`, 408) : err;
      const retryable = !(lastError instanceof GeminiError) || [408, 429, 500, 502, 503, 504].includes(lastError.status);
      if (!retryable || attempt === retries) break;
      await sleep(600 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
