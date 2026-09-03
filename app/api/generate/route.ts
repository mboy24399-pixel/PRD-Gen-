import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-pro']);
const MAX_PROMPT_CHARS = 120_000;

function configuredKeys() {
  return [process.env.GEMINI_API_KEY || '', ...(process.env.GEMINI_API_KEYS || '').split(',')]
    .map((key) => key.trim())
    .filter(Boolean);
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const model = typeof body?.model === 'string' && MODELS.has(body.model) ? body.model : 'gemini-2.5-flash';
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const suppliedKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!prompt) return jsonError('Prompt is required.', 400);
    if (prompt.length > MAX_PROMPT_CHARS) return jsonError('Prompt is too large.', 413);

    // Vercel mode supports either a server-managed key pool or a user-provided
    // BYOK key. Nothing is persisted by this endpoint.
    const keys = suppliedKey ? [suppliedKey] : configuredKeys();
    if (!keys.length) return jsonError('No Gemini API key configured. Add a key in PRD Forge or configure GEMINI_API_KEY(S) on Vercel.', 400);

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
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }

      lastStatus = upstream.status;
      lastBody = (await upstream.text().catch(() => '')).slice(0, 1200);
      // Rotate only on authentication/quota/transient upstream failures.
      if (![401, 403, 429, 500, 502, 503, 504].includes(lastStatus)) break;
    }

    return jsonError(`Gemini request failed (${lastStatus}). ${lastBody}`, lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502);
  } catch (error) {
    console.error('PRD Forge generation error', error);
    return jsonError('Unable to process the generation request.', 500);
  }
}
