# PRD Forge — Deterministic Edition

PRD Forge is a **100% manual, deterministic, offline-first PRD generator**. It has no AI API, no LLM, no provider key, no server database and no network generation path.

## Phase 1 — Architecture Blueprint

```text
app/
  layout.tsx
  page.tsx
  globals.css
components/
  ArchitectureBuilder.tsx
lib/
  db.ts          # Dexie / IndexedDB persistence
  engine.ts      # deterministic routing + estimation
  store.ts       # Zustand state machine
  compiler.ts    # state → Markdown/HTML
  export.ts      # browser-only PDF/DOCX/MD/JSON
public/
types/
  vendor.d.ts
.github/workflows/
  ci.yml
  deploy-pages.yml
```

Core runtime: Next.js App Router + React + TypeScript + Tailwind CSS. State is Zustand. Persistence is Dexie/IndexedDB. Architecture uses React Flow. Manual editing uses TipTap. Motion uses Framer Motion. Exports execute in the browser.

## Phase 2 — State & Logic Engine

`lib/store.ts` owns the 20-step state machine. `lib/engine.ts` owns deterministic rules. Selecting **E-commerce** in Step 7 immediately merges a catalog containing 50+ technical capabilities, 20 schema tables and 25 API routes into the current PRD state. SaaS and Marketplace routing are also included.

The estimator is mathematical rather than model-generated:

- feature complexity points
- schema and endpoint complexity
- configurable risk adjustment
- team skill multiplier
- duration in weeks
- recommended team size
- budget range

No randomness is used for the resulting estimate.

## Phase 3 — Core UI

The application includes:

- 20-step dynamic wizard
- domain routing buttons
- feature catalog
- technology/security/observability/performance checklists
- visual drag/drop architecture canvas
- editable database tables
- editable API routes
- integration planner
- branding panel with colors, typography scale and logo upload
- responsive dark premium UI with animated step transitions

## Phase 4 — Document Compilation & Editor

`lib/compiler.ts` converts the full Zustand state into a deterministic Markdown PRD containing strategy, requirements, architecture, schema, API planning, security, observability, reliability, QA, delivery, risks and the calculated estimate.

The compiled document opens in a TipTap editor for manual refinement.

## Phase 5 — Client-Side Export & Deployment

Exports are browser-only:

- Markdown
- JSON workspace
- Microsoft Word `.docx`
- PDF via `html2pdf.js`

### Run locally

```bash
npm install
npm run dev
```

### Production check

```bash
npm run typecheck
npm run build
npm run start
```

### Vercel

Import the GitHub repository into Vercel. No server environment variables are required.

### Netlify

```bash
npm install
npm run build
```

Publish the generated `out/` directory when using static export mode.

## Data and security

Project data stays in the browser's IndexedDB. Uploaded branding assets are kept in application state and local persistence only. There are no API credentials to leak because the deterministic engine never calls an AI/provider service.

This design intentionally removes the previous provider gateway and browser fetch bridge. Search the repository for provider API keys or `/api/generate`; neither is part of the deterministic architecture.
