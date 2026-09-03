type Provider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'custom';

type ReqBody = {
  provider?: Provider;
  model?: string;
  prompt?: string;
  apiKey?: string;
  baseUrl?: string;
  test?: boolean;
};

const PROVIDERS = new Set<Provider>(['gemini','openrouter','openai','anthropic','groq','mistral','custom']);
const MAX_PROMPT_CHARS = 120_000;
const MAX_BODY_BYTES = 900_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 24;
const RETRYABLE = new Set([401,403,408,409,425,429,500,502,503,504]);
const rate = new Map<string, { start: number; count: number }>();

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit) {
  const merged = new Headers(headers);
  merged.set('Content-Type','application/json; charset=utf-8');
  merged.set('Cache-Control','no-store');
  merged.set('X-Content-Type-Options','nosniff');
  return new Response(JSON.stringify(payload), {status, headers: merged});
}
function envKeys(provider: Provider) {
  const prefix = provider === 'custom' ? 'CUSTOM' : provider.toUpperCase();
  return [process.env[`${prefix}_API_KEY`] || '', ...(process.env[`${prefix}_API_KEYS`] || '').split(',')].map(x=>x.trim()).filter(Boolean);
}
function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}
function withinRateLimit(request: Request) {
  const key = clientIp(request); const now = Date.now(); const old = rate.get(key);
  if (!old || now-old.start >= RATE_WINDOW_MS) { rate.set(key,{start:now,count:1}); return true; }
  old.count += 1; return old.count <= RATE_LIMIT;
}
function configuredOrigins() { return (process.env.PRD_FORGE_ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean); }
function isGithubIo(origin: string) { try { const u=new URL(origin); return u.protocol==='https:' && u.hostname.endsWith('.github.io'); } catch { return false; } }
function originAllowed(request: Request, body: ReqBody) {
  const origin=request.headers.get('origin') || '';
  const suppliedKey=typeof body.apiKey==='string' && body.apiKey.trim().length>0;
  if (suppliedKey) return true;
  if (!origin) return false;
  const configured=configuredOrigins();
  if (configured.length) return configured.includes(origin);
  try { const requestUrl=new URL(request.url); return origin===requestUrl.origin || origin==='http://localhost:3000'; } catch { return false; }
}
function corsHeaders(request: Request, body: ReqBody) {
  const origin=request.headers.get('origin') || ''; const configured=configuredOrigins();
  const allowed=!!origin && (configured.includes(origin) || isGithubIo(origin) || origin==='http://localhost:3000' || (()=>{try{return origin===new URL(request.url).origin;}catch{return false;}})());
  const headers=new Headers();
  if (origin && (allowed || (typeof body.apiKey==='string' && body.apiKey.trim()))) {
    headers.set('Access-Control-Allow-Origin',origin); headers.set('Vary','Origin');
    headers.set('Access-Control-Allow-Headers','Content-Type'); headers.set('Access-Control-Allow-Methods','POST, OPTIONS, GET');
  }
  return headers;
}
function safeBaseUrl(provider: Provider, input?: string) {
  const defaults: Record<Provider,string>={gemini:'https://generativelanguage.googleapis.com',openrouter:'https://openrouter.ai/api',openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com',groq:'https://api.groq.com/openai/v1',mistral:'https://api.mistral.ai/v1',custom:''};
  const raw=typeof input==='string' && input.trim()?input.trim():defaults[provider]; const value=raw.replace(/\/$/,'');
  if (!value.startsWith('https://') && !value.startsWith('http://localhost')) throw new Error('Provider endpoint must use HTTPS.');
  if (provider==='custom') { const allowed=(process.env.PRD_FORGE_CUSTOM_DOMAINS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean); let host=''; try{host=new URL(value).hostname.toLowerCase();}catch{throw new Error('Invalid custom endpoint URL.');} if(!allowed.length || !allowed.includes(host)) throw new Error('Custom endpoints are locked. Add the domain to PRD_FORGE_CUSTOM_DOMAINS on Vercel.'); }
  return value;
}
function headersFor(provider: Provider,key:string): Record<string,string> {
  const common={'Content-Type':'application/json'};
  if(provider==='gemini') return {...common,'x-goog-api-key':key};
  if(provider==='anthropic') return {...common,'x-api-key':key,'anthropic-version':'2023-06-01'};
  return {...common,Authorization:`Bearer ${key}`};
}
function modelsRequest(provider: Provider,baseUrl:string){return provider==='gemini'?`${baseUrl}/v1beta/models`:`${baseUrl}/models`;}
function classifyHealth(status:number,modelAvailable:boolean){if(status>=200&&status<300)return modelAvailable?'valid-model':'valid-key-model-unavailable';if(status===401||status===403)return'invalid-or-restricted-key';if(status===404)return'model-endpoint-not-found';if(status===429)return'rate-limited-or-quota';if(status===400)return'provider-rejected-request';return`provider-error-${status}`;}
function extractProviderDetail(parsed:any,raw:string){return String(parsed?.error?.message||parsed?.message||raw||'Provider rejected the request').replace(/\s+/g,' ').slice(0,500);}
async function checkKey(provider:Provider,key:string,model:string,baseUrl:string){
  const url=modelsRequest(provider,baseUrl); const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),20000);
  try{const upstream=await fetch(url,{method:'GET',headers:headersFor(provider,key),cache:'no-store',signal:controller.signal}); const raw=await upstream.text().catch(()=> ''); let parsed:any=null; try{parsed=JSON.parse(raw);}catch{}
    if(!upstream.ok)return{ok:false,status:upstream.status,health:classifyHealth(upstream.status,false),modelAvailable:false,detail:extractProviderDetail(parsed,raw)};
    const ids=Array.isArray(parsed?.data)?parsed.data.map((x:any)=>String(x?.id||'')).filter(Boolean):Array.isArray(parsed?.models)?parsed.models.map((x:any)=>String(x?.name||'').replace(/^models\//,'')).filter(Boolean):[];
    const normalizedModel=model.replace(/^models\//,''); const modelAvailable=!!normalizedModel&&(ids.includes(normalizedModel)||ids.includes(`models/${normalizedModel}`));
    return{ok:modelAvailable,status:modelAvailable?upstream.status:404,health:classifyHealth(modelAvailable?upstream.status:404,modelAvailable),modelAvailable,models:ids.slice(0,60),detail:modelAvailable?'':`Selected model ${normalizedModel||'(empty)'} is not available for this API key/provider endpoint.`};
  }catch(e){return{ok:false,status:504,health:'network-or-timeout',modelAvailable:false,detail:e instanceof Error?e.message:'Provider health check failed'};}finally{clearTimeout(timeout);}
}
function requestFor(provider:Provider,model:string,prompt:string,baseUrl:string){
  if(provider==='gemini')return{url:`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,body:{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.25,topP:0.9,maxOutputTokens:32000}}};
  if(provider==='anthropic')return{url:`${baseUrl}/v1/messages`,body:{model,max_tokens:32000,temperature:0.25,stream:true,messages:[{role:'user',content:prompt}]}};
  return{url:`${baseUrl}/chat/completions`,body:{model,temperature:0.25,top_p:0.9,max_tokens:32000,stream:true,messages:[{role:'user',content:prompt}]}};
}
function textFromEvent(provider:Provider,data:string){try{const j=JSON.parse(data);if(provider==='gemini')return j?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join('')||'';if(provider==='anthropic')return j?.type==='content_block_delta'?j?.delta?.text||'':'';return j?.choices?.[0]?.delta?.content||'';}catch{return'';}}
function streamNormalized(upstream:Response,provider:Provider){
  if(!upstream.body)throw new Error('Upstream streaming is unavailable.'); const reader=upstream.body.getReader(); const decoder=new TextDecoder(); const encoder=new TextEncoder(); let buffer='';
  const stream=new ReadableStream<Uint8Array>({async pull(controller){try{const{value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop()||'';for(const event of events){for(const line of event.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;const text=textFromEvent(provider,data);if(text)controller.enqueue(encoder.encode(`data: ${JSON.stringify({text})}\n\n`));}}if(done){if(buffer.trim()){for(const line of buffer.split(/\r?\n/)){if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;const text=textFromEvent(provider,data);if(text)controller.enqueue(encoder.encode(`data: ${JSON.stringify({text})}\n\n`));}}controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}}catch(error){controller.error(error);}},cancel(){reader.cancel().catch(()=>undefined);}});
  return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff'}});
}
async function parseBody(request:Request):Promise<ReqBody>{const length=Number(request.headers.get('content-length')||0);if(length>MAX_BODY_BYTES)throw new Error('Request body is too large.');const contentType=request.headers.get('content-type')||'';if(!contentType.toLowerCase().includes('application/json'))throw new Error('Content-Type must be application/json.');const body=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Request body must be a JSON object.');return body as ReqBody;}

export async function handle(request:Request){
  if(request.method==='GET')return jsonResponse({ok:true,service:'prd-forge-gateway',runtime:'next-node-route'});
  if(request.method==='OPTIONS'){const headers=corsHeaders(request,{});headers.set('Access-Control-Max-Age','86400');return new Response(null,{status:204,headers});}
  if(request.method!=='POST')return jsonResponse({error:'Method not allowed.'},405,{Allow:'GET, POST, OPTIONS'});
  let body:ReqBody;try{body=await parseBody(request);}catch(error){const message=error instanceof Error?error.message:'Invalid request body.';return jsonResponse({error:message},message.includes('too large')?413:400);}
  const cors=corsHeaders(request,body);if(!originAllowed(request,body))return jsonResponse({error:'Origin not allowed.'},403,cors);if(!withinRateLimit(request))return jsonResponse({error:'Rate limit reached. Try again in a minute.'},429,cors);
  const provider=PROVIDERS.has(body.provider as Provider)?body.provider as Provider:'gemini';
  const model=typeof body.model==='string'&&body.model.trim()?body.model.trim():provider==='gemini'?'gemini-2.5-flash':provider==='openrouter'?'openrouter/free':'gpt-4o-mini';
  const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
  if(!prompt&&!body.test)return jsonResponse({error:'Prompt is required.'},400,cors);if(prompt.length>MAX_PROMPT_CHARS)return jsonResponse({error:'Prompt is too large.'},413,cors);
  const suppliedKey=typeof body.apiKey==='string'?body.apiKey.trim():'';const keys=suppliedKey?[suppliedKey]:envKeys(provider);if(!keys.length)return jsonResponse({error:`No ${provider} API key configured.`},400,cors);
  let baseUrl:string;try{baseUrl=safeBaseUrl(provider,body.baseUrl);}catch(error){return jsonResponse({error:error instanceof Error?error.message:'Invalid provider endpoint.'},400,cors);}
  if(body.test){let lastHealth:any={ok:false,status:502,health:'no-working-key',modelAvailable:false};for(const key of keys){const health=await checkKey(provider,key,model,baseUrl);if(health.ok)return jsonResponse({...health,provider,model,checkedKeys:keys.length,message:`Key verified and model ${model} is available.`},200,cors);lastHealth=health;}const status=Number(lastHealth.status)||502;return jsonResponse({...lastHealth,provider,model,checkedKeys:keys.length,message:lastHealth.health==='valid-key-model-unavailable'?`API key is valid, but model ${model} is not available. Choose one of the returned models.`:'Key check failed. The key may be invalid/restricted, rate-limited, or the endpoint may be unavailable.'},status>=400&&status<=599?status:502,cors);}
  let lastStatus=502,lastDetail='';
  for(const key of keys){const spec=requestFor(provider,model,prompt,baseUrl);const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);try{const upstream=await fetch(spec.url,{method:'POST',headers:headersFor(provider,key),body:JSON.stringify(spec.body),cache:'no-store',signal:controller.signal});if(upstream.ok&&upstream.body){clearTimeout(timeout);return streamNormalized(upstream,provider);}lastStatus=upstream.status;const raw=await upstream.text().catch(()=> '');let parsed:any=null;try{parsed=JSON.parse(raw);}catch{}lastDetail=extractProviderDetail(parsed,raw);if(!RETRYABLE.has(lastStatus))break;}catch(error){lastStatus=504;lastDetail=error instanceof Error?error.message:'Upstream request failed.';}finally{clearTimeout(timeout);}}
  return jsonResponse({error:'All provider attempts failed.',provider,model,status:lastStatus,detail:lastDetail,retryable:RETRYABLE.has(lastStatus)},lastStatus>=400&&lastStatus<=599?lastStatus:502,cors);
}
