# Hearthworld (v0.4 "Dawn")

**Upgrading from v0.3:** extract over your repo folder (overwrite, keep `.git`), run `npm install`, then
`git add . && git commit -m "Hearthworld v0.4" && git push`. Nothing to delete this time. New Supabase steps: none.

## What it is
Four AI tribes try to survive in a seeded open world (water, grass, forest, rock, sand; spring-to-winter seasons; day and night).
- Settlers move, forage, hunt, farm, quarry, build huts/farms/wells/granaries/palisades, breed, fight wolves, catch fevers and die.
  Every death has a recorded cause: starvation, thirst, cold, wolf, fever, old age, accident.
- 7 inherited genes mutate each generation (thrift, courage, sociability, curiosity, industry, hardiness, huntBias).
  Every gene has a trade-off. Villages also carry a doctrine (hunt/farm/build/stock/defend) that mutates when a village splits,
  so villages drift towards different strategies. Fallen villages leave ruins; newcomers arrive if fewer than 3 villages survive.
- Click any settler: see its current job and WHY (real need/priority numbers), genes, parents and life story.
- **Be the Wanderer** (WASD, E gather, F feed/warm, G leave supplies) or just observe. Speeds: pause / 1x / 2x / 8x / 32x.
  At 1x a day is one minute and a year about 32 minutes.
- **Evolution** tab: population and mean gene per village over time, selection differential (breeders vs non-breeders), death causes.
- Returning later: the world computes the time you were away on your device (1 tick per 3 real seconds, at most 1 year) and shows an Almanac.
- **Delve** keeps Descent (v0.3) as a side mode. **Workshop** keeps the v0.2 maze experiments.

## Honest limits
- No server runs the world: it advances while the tab is open or when you return. A shared, always-on world is a later slice.
- Balance was tuned with headless runs (populations stabilise around 150 across ~6 villages, mixed death causes), but real play will show
  what feels off. Migrants found new villages instantly at the new site (no walking yet).
- Wanderer actions are simple (gather, feed, supply). Buildings, tech tree and Lab-style rule invention are planned for 4.1-4.2.
- Canvas rendering and the worker were verified by build + jsdom smoke tests only, not in a real browser.

---

# Descent: living labyrinth (v0.3)

**Upgrading from v0.2:** extract this zip over your repo folder (overwrite, keep `.git`), then **delete these two files by hand**:
`src/pages/Overview.tsx` and `src/pages/Challenges.tsx` (replaced by Play / Arena). Then `npm install` (new dev deps) and
`git add . && git commit -m "Descent v0.3" && git push`.

## What it is now
- **Play**: today's 5 versions of Descent (control + 4 AI challengers). Fog, keys/doors, hunting Wardens, light budget, boons.
- **Lab**: live Probe / Builder / Instructor chambers with a cull feed that states WHY each agent was removed.
- **Chronicle**: auto-written daily patch notes, master-quality chart, and the Idea Forge (every feature the Builders invented,
  its measured effect on held-out floors, and whether it was merged into the master).
- **Arena**: your own runs. (Verified global leaderboards need a server evaluator. Not built yet.)
- **Workshop**: the old v0.2 maze experiments, playground, chambers and agent library.

## How the daily loop works (all real computation)
1. Builders evolve game versions; they can invent new features by composing a placement with an effect and a power
   (11 effect types: teleport pairs, springs, beacons, light blooms, freezes, decoys, wall breaches, ice, sonar pulses, tides, hushes).
2. Probes (evolving defect hunters) check the candidates; an independent oracle verifies their reports. Verified defects quarantine a version.
3. Five versions go live. Simulated players (5 personas, clearly labelled as models) and YOUR runs, ratings and votes decide popularity.
4. The winner becomes master only if it also passes the Instructor's held-out + regression checks. Best ideas from the other versions are
   ablation-tested and merged (max 2/day). A patch note is written. The next day opens.
5. If you return after N days, the lab computes the N missing days on your device (capped at 14). Slice 4 moves this to a server schedule.

Honest limits: "creative features" are compositions inside a fixed, validated grammar, not free-form code. "Fun" is a model
(simulated personas + your feedback), not measured real-user fun until real telemetry exists (slice 4).

---

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
