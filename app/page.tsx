'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, FileText, Sparkles, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

const templates = ['Web Application','Mobile App','SaaS','E-commerce','API','AI / ML','Desktop','Game','Blockchain','IoT'];
const modes = ['Quick Draft','Standard','Detailed'] as const;

type Mode = typeof modes[number];

export default function Home() {
  const [idea, setIdea] = useState('');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('Web Application');
  const [mode, setMode] = useState<Mode>('Standard');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate(e: FormEvent) {
    e.preventDefault(); setError(''); setResult('');
    if (idea.trim().length < 10) { setError('Describe the product in at least 10 characters.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ productName:name, idea, template, mode }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Generation failed');
      const reader = res.body?.getReader(); if (!reader) throw new Error('Streaming is unavailable.');
      const decoder = new TextDecoder(); let text = '';
      while (true) { const {done,value} = await reader.read(); if (done) break; text += decoder.decode(value,{stream:true}); setResult(text); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Generation failed.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen overflow-hidden">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-300"><FileText size={20}/></div><span className="font-bold tracking-tight">PRD Forge</span></div>
      <a href="#generate" className="btn-secondary">Start building <ArrowRight size={16}/></a>
    </nav>
    <section className="mx-auto max-w-7xl px-6 pb-20 pt-14 text-center">
      <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200"><Sparkles size={14}/> AI-powered product documentation</div>
      <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-[-0.04em] sm:text-7xl">Turn an idea into a <span className="text-indigo-400">production-ready PRD.</span></h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">Describe what you want to build. Forge structures the problem, requirements, users, risks and success criteria into a document your team can actually ship from.</p>
    </section>
    <section id="generate" className="mx-auto grid max-w-7xl gap-6 px-6 pb-24 lg:grid-cols-[1fr_0.9fr]">
      <form onSubmit={generate} className="glass rounded-3xl p-6 sm:p-8">
        <div className="mb-7"><p className="text-sm font-semibold text-indigo-300">01 — Describe</p><h2 className="mt-2 text-2xl font-bold">What are you building?</h2></div>
        <label className="mb-5 block"><span className="mb-2 block text-sm font-medium text-slate-300">Product name <span className="text-slate-600">(optional)</span></span><input className="input" maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. CampusFlow"/></label>
        <label className="mb-5 block"><span className="mb-2 block text-sm font-medium text-slate-300">Product idea</span><textarea className="input min-h-44 resize-y" maxLength={10000} value={idea} onChange={e=>setIdea(e.target.value)} placeholder="A platform that helps college students organize assignments, deadlines and group projects..."/><span className="mt-2 block text-right text-xs text-slate-600">{idea.length}/10,000</span></label>
        <div className="mb-6 grid gap-5 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-medium text-slate-300">Template</span><select className="input" value={template} onChange={e=>setTemplate(e.target.value)}>{templates.map(t=><option key={t}>{t}</option>)}</select></label><div><span className="mb-2 block text-sm font-medium text-slate-300">Generation depth</span><div className="grid grid-cols-3 gap-2">{modes.map(m=><button type="button" key={m} onClick={()=>setMode(m)} className={`rounded-xl border px-2 py-3 text-xs font-semibold ${mode===m?'border-indigo-400/60 bg-indigo-500/15 text-indigo-200':'border-white/10 bg-white/[0.03] text-slate-400'}`}>{m}</button>)}</div></div></div>
        {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <button disabled={busy} className="btn-primary w-full">{busy ? <><span className="animate-pulse">Forging your PRD…</span></> : <>Generate PRD <Sparkles size={16}/></>}</button>
      </form>
      <div className="glass min-h-[520px] rounded-3xl p-6 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold text-indigo-300">02 — Output</p><h2 className="mt-2 text-2xl font-bold">Your PRD</h2></div>{result && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 size={14}/> Generated</span>}</div>{result ? <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-300">{result}</pre> : <div className="flex h-[400px] flex-col items-center justify-center text-center text-slate-600"><FileText size={42} className="mb-4"/><p className="max-w-xs text-sm">Your generated PRD will stream here section by section.</p></div>}</div>
    </section>
    <section className="border-t border-white/5"><div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:grid-cols-3"><Feature icon={<Zap/>} title="Fast" text="Streaming generation gives you useful output immediately."/><Feature icon={<ShieldCheck/>} title="Secure by design" text="No Gemini key is persisted by the generation endpoint."/><Feature icon={<FileText/>} title="Structured" text="Consistent PRD sections instead of generic AI prose."/></div></section>
  </main>
}
function Feature({icon,title,text}:{icon:React.ReactNode,title:string,text:string}) { return <div><div className="mb-4 w-fit rounded-xl bg-white/5 p-3 text-indigo-300">{icon}</div><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div> }
