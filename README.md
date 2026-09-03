# PRD Forge

**PRD Forge** is a GitHub Pages-first AI PRD workspace: guided product intake, Gemini streaming generation, multi-key failover, local project library, autosave, version snapshots, Markdown editing, workspace backup, and exports.

## Live architecture

This repository is intentionally built for **GitHub Pages only**. GitHub Pages is static hosting, so there is no server runtime in the deployed site.

- Next.js 14 static export
- TypeScript + Tailwind CSS
- Browser-only Gemini REST streaming
- BYOK Gemini keys held in memory only
- Multiple-key rotation on 401 / 403 / 429
- LocalStorage project library and 20-second autosave
- Local JSON workspace backup/import
- Markdown, TXT, HTML, DOCX export
- Browser Print → Save as PDF
- GitHub Actions build + GitHub Pages deployment

GitHub Pages supports custom GitHub Actions workflows for static site generators, which is the deployment model used here.

## Security model

A static GitHub Pages site cannot keep a user-supplied Gemini API key secret from the browser. Therefore PRD Forge does **not** pretend to encrypt a client-side secret or ship a hidden server key.

Instead:

1. The user enters their own Gemini key in the session.
2. The key is kept only in JavaScript memory.
3. The key is never placed in source control, localStorage, cookies, or this project's database.
4. Requests go directly to Google's Gemini API.
5. Multiple keys can be loaded and rotated automatically when a key is rejected or rate-limited.
6. Users should use restricted/auth keys and Google quota/billing controls.

Never commit a Gemini API key to GitHub.

## Current Gemini models

The app uses stable `gemini-2.5-flash` for Quick Draft and stable `gemini-2.5-pro` for Standard/Detailed generation. These are current supported model IDs in Google's Gemini API documentation.

## Local development

```bash
npm install
npm run dev
```

For production static output:

```bash
npm run build
```

The static site is emitted to `out/`.

## GitHub Pages

The repository contains `.github/workflows/deploy-pages.yml`. After GitHub Pages is configured to use **GitHub Actions** as its source, pushes to `main` build and deploy the `out/` directory automatically.

Expected site:

`https://mboy24399-pixel.github.io/PRD-Gen-/`

## Important scope boundary

The original product brief includes server-side authentication, encrypted server key storage, Supabase/Postgres, Redis, real-time collaboration, comments, teams, and server-generated exports. Those features require a server-side runtime or managed backend and therefore cannot be implemented honestly as secure runtime features on GitHub Pages alone.

This version deliberately prioritizes a **real, deployable, secure-by-design static product** instead of pretending those backend capabilities exist.

The architecture is kept modular so a future backend can add accounts, cloud persistence, collaboration, and server-side Gemini proxying without changing the core PRD document format.
