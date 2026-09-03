import type { NextApiRequest, NextApiResponse } from 'next';

const MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro']);
const MAX_PROMPT_CHARS = 120_000;

function configuredKeys() {
  return [process.env.GEMINI_API_KEY || '', ...(process.env.GEMINI_API_KEYS || '').split(',')]
    .map((key) => key.trim())
    .filter(Boolean);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const model = typeof req.body?.model === 'string' && MODELS.has(req.body.model) ? req.body.model : 'gemini-2.5-flash';
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const suppliedKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
    if (prompt.length > MAX_PROMPT_CHARS) return res.status(413).json({ error: 'Prompt is too large.' });

    const keys = suppliedKey ? [suppliedKey] : configuredKeys();
    if (!keys.length) return res.status(400).json({ error: 'No Gemini API key configured.' });

    let lastStatus = 500;
    let lastBody = '';

    for (const key of keys) {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.25, topP: 0.9, maxOutputTokens: 32000 },
          }),
          cache: 'no-store',
        },
      );

      if (upstream.ok && upstream.body) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) res.write(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }
        return res.end();
      }

      lastStatus = upstream.status;
      lastBody = (await upstream.text().catch(() => '')).slice(0, 1200);
      if (![401, 403, 429, 500, 502, 503, 504].includes(lastStatus)) break;
    }

    return res.status(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502).json({
      error: `Gemini request failed (${lastStatus}).`,
      detail: lastBody,
    });
  } catch (error) {
    console.error('PRD Forge generation error', error);
    return res.status(500).json({ error: 'Unable to process the generation request.' });
  }
}
