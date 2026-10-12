# AI Evolution Studios — Setup (v0.2: UI + workers + Supabase schema)

## Run locally (Windows PowerShell)
    cd <this folder>
    npm install
    copy .env.example .env.local      # then paste your two Supabase values into .env.local
    npm run dev                       # http://localhost:5173
    npm test                          # 20 tests
    npm run build                     # production build into dist/

Without `.env.local` the app runs in **local-demo mode**: everything works, data stays in your browser (IndexedDB).

## Supabase (project already exists, currently empty)
1. Dashboard -> **SQL Editor** -> New query. Paste the full contents of
   `supabase/migrations/20261012000000_init.sql` and press **Run**. It should say "Success. No rows returned".
   This creates 10 tables, Row Level Security policies, the private `artifacts` storage bucket and one system challenge.
   (Run it only once. Re-running errors with "already exists" because nothing is dropped.)
2. **Authentication -> Sign In / Providers -> Email**: make sure Email is enabled.
   For quick testing you can turn **Confirm email** off; otherwise sign-ups must click a mail link first.
3. **Authentication -> URL Configuration**: Site URL = your deployed URL (once you have it);
   add Redirect URLs: `http://localhost:5173/**` and `https://YOUR-DEPLOYED-URL/**`.
4. Check: **Table Editor** lists chambers, agents, experiments, experiment_metrics, artifacts, game_versions,
   evaluations, challenges, challenge_submissions, profiles. **Storage** shows a private bucket `artifacts`.
5. Settings -> API: Project URL + `anon` key go into `.env.local` (names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   Never use or paste the `service_role` key anywhere in this project.
(Menu labels in the dashboard move around occasionally; the names above are the intent.)

## Deploy to test on a real URL
Both need the code in a GitHub repo first (`.env.local` is git-ignored, so your keys are not committed).

**Vercel**: Add New -> Project -> import repo. Framework Vite is auto-detected (build `npm run build`, output `dist`).
Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, Deploy. `vercel.json` handles SPA routing.

**Cloudflare Pages**: Workers & Pages -> Create -> Pages -> Connect to Git. Build command `npm run build`,
output directory `dist`, env vars: the two `VITE_...` ones plus `NODE_VERSION=20`. `public/_redirects` handles routing.

Vite bakes env vars in at build time: after changing them, trigger a redeploy.
After the first deploy, put the live URL into Supabase Site URL / Redirect URLs (step 3).

## What is in this version
- UI: Overview, My Laboratory (play the maze, watch agents, compare versions), three chamber pages, Experiments
  (create / start / pause / resume / stop / checkpoint export+import / duplicate / delete), Agent Library with lineage,
  Challenges, Leaderboards, Settings, onboarding, local-demo mode.
- Real Web Worker per experiment; stop terminates computation; pause checkpoints and resume continues identically;
  state persists in IndexedDB and survives reloads (reload leaves an experiment *paused*, you press Resume).
- Supabase: auth (sign up / in / out / reset), "Save to cloud" syncs experiment row, aggregated metrics and a checkpoint file.
  RLS verified against an embedded Postgres: users cannot read/modify others' rows, cannot write verified evaluations/scores.

## Not built yet (honest list)
- Reinforcement-learning algorithm, neural-network experiments, WASM/WebGPU backends (WebGPU is only detected).
- Server-side evaluator, so leaderboards cannot show "verified" results; agent publishing/public listing UI.
- Cloud *restore* (download a saved checkpoint back into the app) and cross-device sync.
- Playwright end-to-end tests. UI was build-checked and the store/worker protocol is tested, but I could not open a real browser here.
