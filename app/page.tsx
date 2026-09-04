'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, ChevronLeft, ChevronRight, Download, FileJson, FileText,
  Plus, Save, ShieldCheck, Trash2, Upload, Workflow
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { usePRD, STEPS, type PRDState } from '../lib/store';
import { FEATURES } from '../lib/engine';
import { compileMarkdown, markdownToHtml } from '../lib/compiler';
import { saveProject, listProjects, loadProject, deleteProject } from '../lib/db';
import { exportDocx, exportJson, exportMarkdown, exportPdf } from '../lib/export';
import ArchitectureBuilder from '../components/ArchitectureBuilder';

const TECH = ['Next.js','React','TypeScript','Tailwind CSS','Node.js','Vite','Python','Go','PostgreSQL','MySQL','MongoDB','Redis','SQLite','Firebase','GraphQL','REST','WebSockets','Docker','Kubernetes','Vercel','Netlify','AWS','Cloudflare'];
const SECURITY = ['HTTPS','Input validation','Authentication','Authorization','RBAC','Rate limiting','CSRF protection','XSS prevention','CSP','Secrets management','Audit logging','Data minimization','Backups','Disaster recovery','2FA','Session expiry'];
const OBSERVABILITY = ['Structured logs','Error tracking','Metrics','Health checks','Tracing','Alerting','Audit events','Uptime checks','Performance budgets'];
const PERFORMANCE = ['CDN','Caching','Pagination','Lazy loading','Image optimization','Code splitting','Compression','Database indexes','Query budgets','Rate limiting'];
const INTEGRATIONS = ['Email','Payments','Analytics','Maps','Search','Storage','Calendar','CRM','Webhooks','OAuth','SMS','Push notifications'];

type ListKey = 'techStack' | 'security' | 'observability' | 'performance' | 'integrations';

function Field({ label, value, onChange, placeholder, multi = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multi?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function Checks({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return (
    <div className="check-grid">
      {items.map((item) => (
        <button type="button" key={item} className={selected.includes(item) ? 'check active' : 'check'} onClick={() => onToggle(item)}>
          <span>{selected.includes(item) ? '✓' : '+'}</span>{item}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><small>{label}</small><b>{value}</b></div>;
}

export default function Home() {
  const s = usePRD();
  const [tab, setTab] = useState<'forge' | 'editor' | 'projects' | 'branding'>('forge');
  const [saved, setSaved] = useState<any[]>([]);
  const docRef = useRef<HTMLDivElement>(null);
  const estimate = s.estimate();
  const update = (patch: Partial<PRDState>) => s.set(patch);

  useEffect(() => {
    listProjects().then(setSaved).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!s.product) return;
    const timer = window.setTimeout(() => {
      saveProject(s, s.product).then(() => listProjects().then(setSaved)).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [s.product, s.summary, s.features.length, s.schema.length, s.routes.length, s.step]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Compile the PRD, then refine it manually…' })
    ],
    content: '<h1>Deterministic PRD workspace</h1><p>Compile your 20-step specification to begin manual editing.</p>',
    editorProps: { attributes: { class: 'tiptap-editor' } }
  });

  const toggle = (key: ListKey, item: string) => {
    const values = s[key] as string[];
    update({ [key]: values.includes(item) ? values.filter((v) => v !== item) : [...values, item] } as Partial<PRDState>);
  };

  const compile = () => {
    const markdown = compileMarkdown(s);
    setTab('editor');
    window.setTimeout(() => editor?.commands.setContent(markdownToHtml(markdown, s.branding)), 0);
  };

  const setLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ branding: { ...s.branding, logo: String(reader.result) } });
    reader.readAsDataURL(file);
  };

  const saveNow = async () => {
    await saveProject(s, s.product || 'Untitled PRD');
    setSaved(await listProjects());
  };

  const openProject = async (id: string) => {
    const row = await loadProject(id);
    if (row) {
      s.set(row.state as Partial<PRDState>);
      setTab('forge');
    }
  };

  const renderStep = () => {
    switch (s.step) {
      case 0:
        return <Field label="Product name" value={s.product} onChange={(v) => update({ product: v })} placeholder="e.g. CommerceOS" />;
      case 1:
        return <Field label="Business context" value={s.business} onChange={(v) => update({ business: v })} placeholder="Revenue model, strategy, constraints, stakeholders…" multi />;
      case 2:
        return <Field label="Target audience" value={s.audience} onChange={(v) => update({ audience: v })} placeholder="Personas, roles, company size, geography…" multi />;
      case 3:
        return <><Field label="Core problem" value={s.problem} onChange={(v) => update({ problem: v })} placeholder="What painful job must this product solve?" multi /><Field label="Jobs to be done" value={s.jobs} onChange={(v) => update({ jobs: v })} placeholder="Functional, emotional and social jobs…" multi /></>;
      case 4:
        return <Field label="Goals & measurable KPIs" value={s.goals} onChange={(v) => update({ goals: v })} placeholder="North-star metric, activation, retention, reliability…" multi />;
      case 5:
        return <Field label="Scope & priorities" value={s.scope} onChange={(v) => update({ scope: v })} placeholder="MVP, must/should/could/won't, exclusions…" multi />;
      case 6:
        return (
          <>
            <div className="route-box">
              <b>Deterministic domain router</b>
              <span>Select a domain to inject its technical graph.</span>
              <div className="route-actions">
                {['E-commerce', 'SaaS', 'Marketplace'].map((domain) => <button type="button" key={domain} onClick={() => s.applyDomainRouting(domain)}>{domain}</button>)}
              </div>
            </div>
            <Field label="Feature notes / business rules" value={s.featureNotes} onChange={(v) => update({ featureNotes: v })} placeholder="Rules, edge cases, pricing logic, permissions…" multi />
            <h3 className="sub">Feature catalog • {s.features.length} selected</h3>
            <div className="feature-scroll"><Checks items={FEATURES.map((f) => f.name)} selected={s.features} onToggle={s.toggleFeature} /></div>
          </>
        );
      case 7:
        return <Field label="UX, accessibility & interaction rules" value={s.ux} onChange={(v) => update({ ux: v })} placeholder="Navigation, states, keyboard behavior, empty/error/loading states…" multi />;
      case 8:
        return <><Field label="Platform" value={s.platform} onChange={(v) => update({ platform: v })} /><h3 className="sub">Technology selection</h3><Checks items={TECH} selected={s.techStack} onToggle={(x) => toggle('techStack', x)} /></>;
      case 9:
        return <><Field label="Architecture notes" value={s.architectureNotes} onChange={(v) => update({ architectureNotes: v })} placeholder="Boundary rules, deployment topology, data flow…" multi /><ArchitectureBuilder nodes={s.archNodes} edges={s.archEdges} onChangeNodes={(nodes) => update({ archNodes: nodes })} onChangeEdges={(edges) => update({ archEdges: edges })} /></>;
      case 10:
        return (
          <>
            <div className="inline-head"><h3 className="sub">Database schema</h3><button type="button" className="small-btn" onClick={s.addTable}><Plus size={14} /> Add table</button></div>
            <div className="schema-grid">
              {s.schema.map((table, tableIndex) => (
                <div className="schema-card" key={`${table.name}-${tableIndex}`}>
                  <input value={table.name} onChange={(e) => update({ schema: s.schema.map((x, i) => i === tableIndex ? { ...x, name: e.target.value } : x) })} />
                  {table.fields.map((field, fieldIndex) => (
                    <div className="schema-field" key={`${tableIndex}-${fieldIndex}`}>
                      <input value={field.name} onChange={(e) => update({ schema: s.schema.map((x, i) => i === tableIndex ? { ...x, fields: x.fields.map((f, j) => j === fieldIndex ? { ...f, name: e.target.value } : f) } : x) })} />
                      <select value={field.type} onChange={(e) => update({ schema: s.schema.map((x, i) => i === tableIndex ? { ...x, fields: x.fields.map((f, j) => j === fieldIndex ? { ...f, type: e.target.value } : f) } : x) })}>
                        {['uuid','text','integer','decimal','boolean','timestamp'].map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        );
      case 11:
        return (
          <>
            <div className="inline-head"><h3 className="sub">API endpoint planner • {s.routes.length}</h3><button type="button" className="small-btn" onClick={s.addRoute}><Plus size={14} /> Add route</button></div>
            <div className="route-table">
              {s.routes.map((route, index) => (
                <div className="route-row" key={`${route.method}-${route.path}-${index}`}>
                  <select value={route.method} onChange={(e) => update({ routes: s.routes.map((x, i) => i === index ? { ...x, method: e.target.value as typeof route.method } : x) })}>{['GET','POST','PUT','PATCH','DELETE'].map((method) => <option key={method}>{method}</option>)}</select>
                  <input value={route.path} onChange={(e) => update({ routes: s.routes.map((x, i) => i === index ? { ...x, path: e.target.value } : x) })} />
                  <input value={route.purpose} onChange={(e) => update({ routes: s.routes.map((x, i) => i === index ? { ...x, purpose: e.target.value } : x) })} />
                  <label className="mini-check"><input type="checkbox" checked={route.auth} onChange={(e) => update({ routes: s.routes.map((x, i) => i === index ? { ...x, auth: e.target.checked } : x) })} /> Auth</label>
                </div>
              ))}
            </div>
          </>
        );
      case 12:
        return <><h3 className="sub">Integrations</h3><Checks items={INTEGRATIONS} selected={s.integrations} onToggle={(x) => toggle('integrations', x)} /></>;
      case 13:
        return <><h3 className="sub">Security standards</h3><Checks items={SECURITY} selected={s.security} onToggle={(x) => toggle('security', x)} /></>;
      case 14:
        return <><h3 className="sub">Observability</h3><Checks items={OBSERVABILITY} selected={s.observability} onToggle={(x) => toggle('observability', x)} /></>;
      case 15:
        return <><h3 className="sub">Performance & reliability</h3><Checks items={PERFORMANCE} selected={s.performance} onToggle={(x) => toggle('performance', x)} /><div className="two"><Field label="Extra complexity points" value={String(s.extraPoints)} onChange={(v) => update({ extraPoints: Math.max(0, Number(v) || 0) })} /><Field label="Risk adjustment %" value={String(s.riskPercent)} onChange={(v) => update({ riskPercent: Math.max(0, Math.min(200, Number(v) || 0)) })} /></div></>;
      case 16:
        return <Field label="QA & acceptance strategy" value={s.qa} onChange={(v) => update({ qa: v })} placeholder="Test matrix, acceptance criteria, regression, security and performance gates…" multi />;
      case 17:
        return <Field label="Delivery plan" value={s.delivery} onChange={(v) => update({ delivery: v })} placeholder="Milestones, dependencies, release strategy, team ownership…" multi />;
      case 18:
        return <><Field label="Risks & mitigations" value={s.risks} onChange={(v) => update({ risks: v })} placeholder="Technical, product, legal, security, operational and adoption risks…" multi /><Field label="Assumptions & open questions" value={s.assumptions} onChange={(v) => update({ assumptions: v })} placeholder="Facts that must be validated before implementation…" multi /></>;
      default:
        return <div className="review"><h3>Ready to publish</h3><p>The compiler will deterministically generate the complete PRD from this state.</p><div className="estimate-grid"><Metric label="Complexity" value={`${estimate.points} pts`} /><Metric label="Duration" value={`${estimate.weeks} weeks`} /><Metric label="Team" value={`${estimate.team} people`} /><Metric label="Budget" value={`$${estimate.low.toLocaleString()}–$${estimate.high.toLocaleString()}`} /></div><div className="ready-list">{STEPS.map((step, index) => <span key={step}><Check size={12} />{index + 1}. {step}</span>)}</div></div>;
    }
  };

  return (
    <main className="app-shell">
      <header className="top">
        <div className="brand"><div className="brand-mark">PF</div><div><b>PRD Forge</b><span>Deterministic • Offline First</span></div></div>
        <nav>{[['forge','Forge'],['editor','Editor'],['projects','Library'],['branding','Branding']].map(([id,label]) => <button type="button" key={id} className={tab === id ? 'nav-on' : ''} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</nav>
        <div className="top-right"><span className="offline"><i />Local only</span><button type="button" className="reset" onClick={() => { if (window.confirm('Reset this local PRD?')) s.reset(); }}>Reset</button></div>
      </header>

      <section className="hero"><div><div className="eyebrow">FULL MEHNAT ENGINE</div><h1>Build a <em>production-grade PRD</em> without AI.</h1><p>20 deterministic steps, algorithmic domain routing, visual architecture, schema/API planning, estimation and browser-only exports. No LLM, no API key, no server database.</p></div><div className="hero-metrics"><Metric label="Steps" value="20" /><Metric label="Storage" value="IndexedDB" /><Metric label="AI calls" value="0" /></div></section>

      {tab === 'forge' && (
        <section className="forge-grid">
          <div className="panel wizard">
            <div className="panel-head"><div><small>STEP {s.step + 1} / 20</small><h2>{STEPS[s.step]}</h2></div><span className="progress">{Math.round(((s.step + 1) / 20) * 100)}%</span></div>
            <div className="progress-bar"><span style={{ width: `${((s.step + 1) / 20) * 100}%` }} /></div>
            <div className="step-body"><AnimatePresence mode="wait"><motion.div key={s.step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>{renderStep()}</motion.div></AnimatePresence></div>
            <div className="wizard-foot"><button type="button" className="secondary" onClick={s.prev} disabled={s.step === 0}><ChevronLeft size={15} /> Previous</button><div className="step-dots">{STEPS.map((step, index) => <button type="button" aria-label={`Step ${index + 1}`} className={index === s.step ? 'dot on' : 'dot'} onClick={() => update({ step: index })} key={step} />)}</div>{s.step === STEPS.length - 1 ? <button type="button" className="primary" onClick={compile}>Compile PRD <Workflow size={15} /></button> : <button type="button" className="primary" onClick={s.next}>Next <ChevronRight size={15} /></button>}</div>
          </div>
          <aside className="panel side"><div className="panel-head"><div><small>LIVE ENGINE</small><h2>Complexity meter</h2></div><ShieldCheck size={18} /></div><div className="meter"><div className="meter-ring"><b>{estimate.points}</b><span>points</span></div><div><strong>{estimate.weeks} weeks</strong><p>{estimate.team} person recommended team</p><p>${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()} budget model</p></div></div><div className="side-section"><small>Deterministic routing</small><p>Choose E-commerce in Step 7 and the engine injects <b>50+ capabilities</b>, schemas and API routes instantly.</p></div><div className="side-section"><small>Local persistence</small><p>State is stored in IndexedDB. Nothing is sent to an AI service.</p></div><button type="button" className="compile-card" onClick={compile}><FileText size={17} /><span><b>Compile current PRD</b><small>Open editable document</small></span><ChevronRight size={15} /></button></aside>
        </section>
      )}

      {tab === 'editor' && <section className="panel editor-panel"><div className="panel-head"><div><small>DOCUMENT</small><h2>Notion-like manual refinement</h2></div><div className="toolbar"><button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button><button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button><button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button></div></div><div className="editor-wrap"><EditorContent editor={editor} /></div><div className="export-row"><button type="button" className="primary" onClick={compile}>Recompile</button><button type="button" className="secondary" onClick={() => exportMarkdown(compileMarkdown(s))}><Download size={14} /> Markdown</button><button type="button" className="secondary" onClick={() => exportDocx(compileMarkdown(s))}><FileText size={14} /> Word</button><button type="button" className="secondary" onClick={() => docRef.current && exportPdf(docRef.current)}><Download size={14} /> PDF</button><button type="button" className="secondary" onClick={() => exportJson(s)}><FileJson size={14} /> JSON</button><button type="button" className="secondary" onClick={saveNow}><Save size={14} /> Save</button></div><div ref={docRef} className="pdf-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(compileMarkdown(s), s.branding) }} /></section>}

      {tab === 'projects' && <section className="panel library"><div className="panel-head"><div><small>LOCAL LIBRARY</small><h2>{saved.length} projects</h2></div><button type="button" className="primary small" onClick={saveNow}><Save size={14} /> Save snapshot</button></div><div className="project-grid">{saved.length ? saved.map((project) => <article className="project-card" key={project.id}><div><b>{project.name}</b><small>{new Date(project.updatedAt).toLocaleString()}</small></div><div className="project-actions"><button type="button" onClick={() => openProject(project.id)}>Open</button><button type="button" onClick={async () => { await deleteProject(project.id); setSaved(await listProjects()); }}><Trash2 size={13} /></button></div></article>) : <div className="empty">No projects yet. Your first snapshot will live entirely in this browser.</div>}</div></section>}

      {tab === 'branding' && <section className="panel branding"><div className="panel-head"><div><small>EXPORT SYSTEM</small><h2>Document branding</h2></div><Upload size={17} /></div><div className="brand-grid"><div><Field label="Primary hex" value={s.branding.primary} onChange={(v) => update({ branding: { ...s.branding, primary: v } })} /><Field label="Secondary hex" value={s.branding.secondary} onChange={(v) => update({ branding: { ...s.branding, secondary: v } })} /><label className="field"><span>Typography scale</span><input type="range" min="0.85" max="1.35" step="0.05" value={s.branding.fontScale} onChange={(e) => update({ branding: { ...s.branding, fontScale: Number(e.target.value) } })} /></label><label className="field"><span>Density</span><select value={s.branding.density} onChange={(e) => update({ branding: { ...s.branding, density: e.target.value as typeof s.branding.density } })}><option value="compact">compact</option><option value="comfortable">comfortable</option><option value="spacious">spacious</option></select></label><label className="field"><span>SVG / image logo</span><input type="file" accept="image/svg+xml,image/png" onChange={(e) => setLogo(e.target.files?.[0])} /></label></div><div className="brand-preview" style={{ borderColor: s.branding.primary }}>{s.branding.logo ? <img src={s.branding.logo} alt="Uploaded logo" /> : <div className="logo-placeholder">LOGO</div>}<h3 style={{ color: s.branding.primary }}>{s.product || 'Your Product'}</h3><p>Production PRD • deterministic export</p></div></div></section>}

      <footer><span>PRD Forge · deterministic local generator</span><span>No AI APIs · No LLM · No server DB</span></footer>
    </main>
  );
}
