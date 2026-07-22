# JumbiTech Portal

Placement management platform: candidates, staff and clients. React front-end
built to `docs/` and served by GitHub Pages at https://portal.jumbitech.com.
Backend: Supabase (ref `vxmoubfkucsygyfkxnya`) — Postgres with row-level
security requiring MFA (aal2) on all sensitive tables, private contract
storage with signed URLs, append-only audit log.

## Operating procedure
- Source of truth is this repo. Clone fresh, `git pull --rebase` before pushing.
- Every change: patch → `npm run build` → `node tests/run-tests.js` (must be
  green) → bump `APP_BUILD` in `src/lib/config.js` and `CACHE` in
  `public/sw.js` in lockstep → commit → push → verify Pages build via
  `api.github.com`.
- Database changes: numbered idempotent migrations in `supabase/migrations`,
  run via the Management API only with explicit authorisation; JSON backup
  first once data exists; `NOTIFY pgrst, 'reload schema';` after DDL.

## Structure
- `src/` app source (React, HashRouter) · `public/` sw.js, manifest, CNAME
- `docs/` built output served by Pages · `supabase/migrations/` schema + RLS
- `tests/run-tests.js` jsdom suite, plain node
