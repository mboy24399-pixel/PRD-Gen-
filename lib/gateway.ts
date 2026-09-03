type Provider = 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'custom';

type ReqBody = { provider?: Provider; model?: string; prompt?: string; apiKey?: string; baseUrl?: string; test?: boolean };

const PROVIDERS = new Set<Provider>(['gemini','openrouter','openai','anthropic','groq','mistral','custom']);
const MAX_PROMPT_CHARS = 120_000;
const MAX_BODY_BYTES = 900_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 24;
const RETRYABLE = new Set([401,403,408,409,425,429,500,502,503,504]);
const rate = new Map<string,{start:number;count:number}>();

function jsonResponse(payload:unknown,status=200,headers?:HeadersInit){const h=new Headers(headers);h.set('Content-Type','application/json; charset=utf-8');h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');return new Response(JSON.stringify(payload),{status,headers:h});}
function envKeys(provider:Provider){const prefix=provider==='custom'?'CUSTOM':provider.toUpperCase();return [process.env[`${prefix}_API_KEY`]||'',...(process.env[`${prefix}_API_KEYS`]||'').split(',')].map(x=>x.trim()).filter(Boolean);}
function clientIp(r:Request){return (r.headers.get('x-forwarded-for')||'').split(',')[0].trim()||r.headers.get('x-real-ip')||'unknown';}
function withinRateLimit(r:Request){const k=clientIp(r),now=Date.now(),old=rate.get(k);if(!old||now-old.start>=RATE_WINDOW_MS){rate.set(k,{start:now,count:1});return true;}old.count+=1;return old.count<=RATE_LIMIT;}
function configuredOrigins(){return (process.env.PRD_FORGE_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);}
function isGithubIo(origin:string){try{const u=new URL(origin);return u.protocol==='https:'&&u.hostname.endsWith('.github.io');}catch{return false;}}
function originAllowed(r:Request,b:ReqBody){const o=r.headers.get('origin')||'',key=typeof b.apiKey==='string'&&b.apiKey.trim();if(key)return true;if(!o)return false;const c=configuredOrigins();if(c.length)return c.includes(o);try{return o===new URL(r.url).origin||o==='http://localhost:3000'||isGithubIo(o);}catch{return false;}}
function corsHeaders(r:Request,b:ReqBody){const o=r.headers.get('origin')||'',c=configuredOrigins(),allowed=!!o&&(c.includes(o)||isGithubIo(o)||o==='http://localhost:3000'||(()=>{try{return o===new URL(r.url).origin;}catch{return false;}})());const h=new Headers();if(o&&(allowed||typeof b.apiKey==='string'&&b.apiKey.trim())){h.set('Access-Control-Allow-Origin',o);h.set('Vary','Origin');h.set('Access-Control-Allow-Headers','Content-Type');h.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}return h;}
function safeBaseUrl(p:Provider,input?:string){const d:Record<Provider,string>={gemini:'https://generativelanguage.googleapis.com',openrouter:'https://openrouter.ai/api',openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com',groq:'https://api.groq.com/openai/v1',mistral:'https://api.mistral.ai/v1',custom:''};const v=(input?.trim()||d[p]).replace(/\/$/,'');if(!v.startsWith('https://')&&!v.startsWith('http://localhost'))throw new Error('Provider endpoint must use HTTPS.');if(p==='custom'){const allowed=(process.env.PRD_FORGE_CUSTOM_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);let host='';try{host=new URL(v).hostname.toLowerCase();}catch{throw new Error('Invalid custom endpoint URL.');}if(!allowed.length||!allowed.includes(host))throw new Error('Custom endpoints are locked.');}return v;}
function headersFor(p:Provider,key:string):Record<string,string>{const c={'Content-Type':'application/json'};if(p==='gemini')return {...c,'x-goog-api-key':key};if(p==='anthropic')return {...c,'x-api-key':key,'anthropic-version':'2023-06-01'};return {...c,Authorization:`Bearer ${key}`};}
function canonicalModel(p:Provider,m:string){const x=m.trim().replace(/^models\//,'');return p==='gemini'?(x||'gemini-2.5-flash'):x;}
function modelsUrl(p:Provider,b:string){return p==='gemini'?`${b}/v1beta/models`:`${b}/models`;}
function extractDetail(j:any,raw:string){return String(j?.error?.message||j?.message||j?.error?.status||raw||'Provider rejected the request').replace(/\s+/g,' ').slice(0,500);}

async function checkKey(p:Provider,key:string,model:string,b:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
  const m=canonicalModel(p,model);
  const url=p==='gemini'?`${b}/v1beta/models/${encodeURIComponent(m)}`:modelsUrl(p,b);
  const r=await fetch(url,{headers:headersFor(p,key),cache:'no-store',signal:controller.signal});
  const raw=await r.text().catch(()=>''),j=(()=>{try{return JSON.parse(raw);}catch{return null;}})();
  if(!r.ok)return{ok:false,status:r.status,modelAvailable:false,health:r.status===429?'rate-limited-or-quota':r.status===401||r.status===403?'invalid-or-restricted-key':'provider-error',detail:extractDetail(j,raw)};
  if(p==='gemini'){
    const supported=Array.isArray(j?.supportedGenerationMethods)?j.supportedGenerationMethods.map((x:any)=>String(x)):[];
    const available=String(j?.name||'').replace(/^models\//,'')===m&&(supported.length===0||supported.includes('generateContent'));
    return{ok:available,status:available?200:404,modelAvailable:available,models:[m],health:available?'valid-model':'valid-key-model-unavailable',detail:available?'':`Selected model ${m} is not available for text generation.`};
  }
  const ids=Array.isArray(j?.data)?j.data.map((x:any)=>String(x?.id||'')).filter(Boolean):Array.isArray(j?.models)?j.models.map((x:any)=>String(x?.name||x?.id||'').replace(/^models\//,'')).filter(Boolean):[];
  const available=!!m&&ids.includes(m);
  return{ok:available,status:available?200:404,modelAvailable:available,models:ids.slice(0,80),health:available?'valid-model':'valid-key-model-unavailable',detail:available?'':`Selected model ${m} is not available for this API key.`};
}catch(e){return{ok:false,status:504,modelAvailable:false,health:'network-or-timeout',detail:e instanceof Error?e.message:'Provider health check failed'};}finally{clearTimeout(timer);}}

async function streamProvider(p:Provider,key:string,model:string,prompt:string,b:string){const m=canonicalModel(p,model);let url:string,body:any;
  if(p==='gemini'){
    url=`${b}/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`;
    body={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.25,topP:0.9,maxOutputTokens:16000}};
  }else if(p==='anthropic'){
    url=`${b}/v1/messages`;
    body={model:m,max_tokens:16000,temperature:0.25,stream:true,messages:[{role:'user',content:prompt}]};
  }else{
    url=`${b}/chat/completions`;
    body={model:m,temperature:0.25,top_p:0.9,max_tokens:16000,stream:true,messages:[{role:'user',content:prompt}]};
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),150000);
  try{
    const r=await fetch(url,{method:'POST',headers:headersFor(p,key),body:JSON.stringify(body),cache:'no-store',signal:controller.signal});
    if(!r.ok){const raw=await r.text().catch(()=>''),j=(()=>{try{return JSON.parse(raw);}catch{return null;}})();return{response:null,status:r.status,detail:extractDetail(j,raw)};}
    if(!r.body)return{response:null,status:502,detail:'Provider returned an empty response stream.'};
    const reader=r.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='';
    const stream=new ReadableStream<Uint8Array>({async pull(c){try{
      const {value,done}=await reader.read();
      buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
      const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop()||'';
      for(const ev of events){for(const line of ev.split(/\r?\n/)){
        if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();if(!d||d==='[DONE]')continue;
        try{const j=JSON.parse(d);const text=p==='gemini'?(j?.candidates?.[0]?.content?.parts||[]).map((x:any)=>x?.text||'').join(''):p==='anthropic'?(j?.type==='content_block_delta'?j?.delta?.text||'':''):j?.choices?.[0]?.delta?.content||'';if(text)c.enqueue(encoder.encode(`data: ${JSON.stringify({text})}\n\n`));}catch{}
      }}
      if(done){c.enqueue(encoder.encode('data: [DONE]\n\n'));c.close();}
    }catch(e){c.error(e);}} ,cancel(){reader.cancel().catch(()=>undefined);}});
    return{response:new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'}}),status:200,detail:''};
  }catch(e){return{response:null,status:504,detail:e instanceof Error?e.message:'Provider request timed out.'};}
  finally{clearTimeout(timer);}
}

async function parseBody(r:Request):Promise<ReqBody>{const n=Number(r.headers.get('content-length')||0);if(n>MAX_BODY_BYTES)throw new Error('Request body is too large.');const ct=r.headers.get('content-type')||'';if(!ct.toLowerCase().includes('application/json'))throw new Error('Content-Type must be application/json.');const b=await r.json();if(!b||typeof b!=='object'||Array.isArray(b))throw new Error('Request body must be a JSON object.');return b as ReqBody;}

export async function handle(request:Request){
  if(request.method==='GET')return jsonResponse({ok:true,service:'prd-forge-gateway',runtime:'next-node-route',version:'stream-first-3'});
  if(request.method==='OPTIONS'){const h=corsHeaders(request,{});h.set('Access-Control-Max-Age','86400');return new Response(null,{status:204,headers:h});}
  if(request.method!=='POST')return jsonResponse({error:'Method not allowed.'},405,{Allow:'GET, POST, OPTIONS'});
  let body:ReqBody;try{body=await parseBody(request);}catch(e){return jsonResponse({error:e instanceof Error?e.message:'Invalid request body.'},400);}
  const cors=corsHeaders(request,body);if(!originAllowed(request,body))return jsonResponse({error:'Origin not allowed.'},403,cors);if(!withinRateLimit(request))return jsonResponse({error:'Rate limit reached. Try again in a minute.'},429,cors);
  const provider=PROVIDERS.has(body.provider as Provider)?body.provider as Provider:'gemini';
  const model=canonicalModel(provider,typeof body.model==='string'&&body.model.trim()?body.model:provider==='gemini'?'gemini-2.5-flash':provider==='openrouter'?'openrouter/free':'gpt-4o-mini');
  const prompt=typeof body.prompt==='string'?body.prompt.trim():'';if(!prompt&&!body.test)return jsonResponse({error:'Prompt is required.'},400,cors);if(prompt.length>MAX_PROMPT_CHARS)return jsonResponse({error:'Prompt is too large.'},413,cors);
  const supplied=typeof body.apiKey==='string'?body.apiKey.trim():'';const keys=supplied?[supplied]:envKeys(provider);if(!keys.length)return jsonResponse({error:`No ${provider} API key configured.`},400,cors);
  let base:string;try{base=safeBaseUrl(provider,body.baseUrl);}catch(e){return jsonResponse({error:e instanceof Error?e.message:'Invalid provider endpoint.'},400,cors);}
  if(body.test){let last:any={ok:false,status:502,health:'no-working-key'};for(const key of keys){const h=await checkKey(provider,key,model,base);if(h.ok)return jsonResponse({...h,provider,model,checkedKeys:keys.length,message:`Key verified and model ${model} is available.`},200,cors);last=h;}const st=Number(last.status)||502;return jsonResponse({...last,provider,model,checkedKeys:keys.length,message:last.detail||'Key verification failed.'},st>=400&&st<=599?st:502,cors);}
  let lastStatus=502,lastDetail='No provider route succeeded.';
  for(const key of keys){const streamed=await streamProvider(provider,key,model,prompt,base);if(streamed.response)return streamed.response;lastStatus=streamed.status;lastDetail=streamed.detail||lastDetail;if(!RETRYABLE.has(lastStatus))break;}
  return jsonResponse({error:'Generation could not be completed.',provider,model,status:lastStatus,retryable:RETRYABLE.has(lastStatus),detail:lastDetail},502,cors);
}
