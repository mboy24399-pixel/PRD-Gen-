import type { NextApiRequest, NextApiResponse } from 'next';

type Provider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'custom';
type ReqBody = { provider?: Provider; model?: string; prompt?: string; apiKey?: string; baseUrl?: string; test?: boolean };

const PROVIDERS = new Set<Provider>(['gemini', 'openrouter', 'openai', 'anthropic', 'groq', 'mistral', 'custom']);
const MAX_PROMPT_CHARS = 120_000;
const MAX_BODY_BYTES = 900_000;
const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function envKeys(provider: Provider) {
  const prefix = provider === 'custom' ? 'CUSTOM' : provider.toUpperCase();
  return [process.env[`${prefix}_API_KEY`] || '', ...(process.env[`${prefix}_API_KEYS`] || '').split(',')]
    .map((x) => x.trim()).filter(Boolean);
}
function originAllowed(req: NextApiRequest) {
  const body = (req.body || {}) as ReqBody;
  // Browser BYOK is intentionally allowed cross-origin so the GitHub Pages build can use the Vercel gateway.
  // Server-managed environment keys remain same-origin/allow-listed only.
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) return true;
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (!origin) return true;
  const configured = (process.env.PRD_FORGE_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (configured.length) return configured.includes(origin);
  const host = req.headers.host || '';
  return origin === `https://${host}` || origin === `http://${host}` || origin === 'http://localhost:3000';
}
function json(res: NextApiResponse, status: number, payload: unknown) { return res.status(status).json(payload); }
function safeBaseUrl(provider: Provider, input?: string) {
  const defaults: Record<Provider, string> = {
    gemini: 'https://generativelanguage.googleapis.com', openrouter: 'https://openrouter.ai/api', openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com', groq: 'https://api.groq.com/openai/v1', mistral: 'https://api.mistral.ai/v1', custom: '',
  };
  const value = (input || defaults[provider]).trim().replace(/\/$/, '');
  if (!value.startsWith('https://') && !value.startsWith('http://localhost')) throw new Error('Provider endpoint must use HTTPS.');
  return value;
}
function headersFor(provider: Provider, key: string) {
  if (provider === 'gemini') return { 'Content-Type': 'application/json', 'x-goog-api-key': key };
  if (provider === 'anthropic') return { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}
function requestFor(provider: Provider, model: string, prompt: string, baseUrl: string) {
  if (provider === 'gemini') return { url: `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, body: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, topP: 0.9, maxOutputTokens: 32000 } } };
  if (provider === 'anthropic') return { url: `${baseUrl}/v1/messages`, body: { model, max_tokens: 32000, temperature: 0.25, stream: true, messages: [{ role: 'user', content: prompt }] } };
  return { url: `${baseUrl}/chat/completions`, body: { model, temperature: 0.25, top_p: 0.9, max_tokens: 32000, stream: true, messages: [{ role: 'user', content: prompt }] } };
}
function textFromEvent(provider: Provider, data: string) {
  try {
    const j = JSON.parse(data);
    if (provider === 'gemini') return j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    if (provider === 'anthropic') return j?.type === 'content_block_delta' ? j?.delta?.text || '' : '';
    return j?.choices?.[0]?.delta?.content || '';
  } catch { return ''; }
}
async function streamNormalized(res: NextApiResponse, upstream: Response, provider: Provider) {
  if (!upstream.body) throw new Error('Upstream streaming is unavailable.');
  res.statusCode = 200; res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.setHeader('X-Content-Type-Options', 'nosniff');
  const reader = upstream.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  const send = (text: string) => { if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`); };
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split(/\n\n|\r\n\r\n/); buffer = events.pop() || '';
    for (const event of events) { for (const line of event.split(/\r?\n/)) { if (!line.startsWith('data:')) continue; const data=line.slice(5).trim(); if (!data || data==='[DONE]') continue; send(textFromEvent(provider,data)); } }
    if (done) break;
  }
  if (buffer.trim()) for (const line of buffer.split(/\r?\n/)) { if (!line.startsWith('data:')) continue; const data=line.slice(5).trim(); if(data&&data!=='[DONE]') send(textFromEvent(provider,data)); }
  res.write('data: [DONE]\n\n'); res.end();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }); }
  if (!originAllowed(req)) return json(res, 403, { error: 'Origin not allowed.' });
  try {
    const rawLength = Number(req.headers['content-length'] || 0); if (rawLength > MAX_BODY_BYTES) return json(res, 413, { error: 'Request body is too large.' });
    const body = (req.body || {}) as ReqBody; const provider = PROVIDERS.has(body.provider as Provider) ? body.provider as Provider : 'gemini';
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openrouter' ? 'openrouter/free' : 'gpt-4o-mini';
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''; if (!prompt) return json(res, 400, { error: 'Prompt is required.' }); if (prompt.length > MAX_PROMPT_CHARS) return json(res, 413, { error: 'Prompt is too large.' });
    const suppliedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''; const keys = suppliedKey ? [suppliedKey] : envKeys(provider); if (!keys.length) return json(res, 400, { error: `No ${provider} API key configured.` });
    const baseUrl = safeBaseUrl(provider, body.baseUrl); let lastStatus = 502; let lastDetail = '';
    for (const key of keys) {
      const reqSpec = requestFor(provider, model, prompt, baseUrl); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90_000);
      try {
        const upstream = await fetch(reqSpec.url, { method: 'POST', headers: headersFor(provider,key), body: JSON.stringify(reqSpec.body), cache: 'no-store', signal: controller.signal });
        if (upstream.ok && upstream.body) { if (body.test) { clearTimeout(timeout); return json(res, 200, { ok: true, provider, model, message: 'Provider authentication and request path are healthy.' }); } clearTimeout(timeout); return await streamNormalized(res, upstream, provider); }
        lastStatus = upstream.status; lastDetail = (await upstream.text().catch(()=>'' )).slice(0, 1000); if (!RETRYABLE.has(lastStatus)) break;
      } catch (e) { lastStatus = 504; lastDetail = e instanceof Error ? e.message : 'Upstream request failed'; }
      finally { clearTimeout(timeout); }
    }
    return json(res, lastStatus, { error: `${provider} request failed (${lastStatus}).`, detail: lastDetail });
  } catch (error) { console.error('PRD Forge provider error', error); return json(res, 500, { error: error instanceof Error ? error.message : 'Unable to process request.' }); }
}
