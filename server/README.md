# Asteroids Royale multiplayer server

An authoritative WebSocket server for real-time PvP. It reuses the exact same
gameplay logic as the site's game client (`stepSimulation` in
`../src/game/simulation.ts`, plus `entities.ts` / `zone.ts` / `vector.ts`) via
relative imports, so there is only ever one copy of the physics/collision
code to maintain.

## How it works

- Runs a single persistent arena on a fixed-size world (1600x900), independent
  of any player's screen size — the client scales/letterboxes this to fit
  whatever viewport it has.
- Players connect anytime. If a match is already running they're added to it
  directly; otherwise they sit in a waiting state until at least 2 players are
  connected.
- Ticks the simulation at a fixed rate (see `TICK_RATE` in `src/index.ts`) and
  broadcasts the full world state + a list of cosmetic events (explosions,
  hits, pickups) to every connected client as JSON.
- A match auto-restarts a couple of seconds after it ends, or drops back to
  "waiting" if too few players remain.
- Rounds start with at least 4 ships — bots (reusing the same AI as local
  play) fill any empty seats so a lone player doesn't have to wait for
  three more humans to show up. Bots are round-scoped only (not tracked as
  connections) and aren't backfilled mid-round if a human leaves.

This process must stay running continuously (it holds all game state in
memory) — it is **not** a serverless/request-response service like the rest
of the Next.js site. It needs its own always-on host.

## Running locally

```bash
cd server
npm install
npm run dev      # tsx watch, restarts on file changes
# or: npm start   # same thing without the file watcher
```

Listens on `PORT` (env var), defaulting to `8080`.

Then point the site's game client at it: in the repo root `.env.local`, set
`NEXT_PUBLIC_MULTIPLAYER_URL=ws://localhost:8080` (this is already the
default if unset) and run the site's own `npm run dev`.

## Deploying (Railway)

- This needs to be a **separate service** from the main Next.js site — it's
  a long-running process holding in-memory game state, not something that
  fits a serverless/edge function model.
- Add a new service in the same Railway project. **Leave its Root Directory
  unset** (repo root) — setting it to `server` makes Nixpacks build from
  just that subfolder, which breaks the `../src/game/...` relative imports
  (they resolve outside the copied build context and the server crashes at
  startup with `ERR_MODULE_NOT_FOUND`).
- With Root Directory unset, Railway's config-as-code auto-discovery reads
  the **root** `railway.toml` (the main site's — `npm run build` / `npm run
  start`) for every service in the project unless told otherwise, so this
  service will silently run the *website* instead of the multiplayer
  server if left on auto-discovery. Explicitly point it at this folder's
  config instead: **Settings → Config-as-code → Add File Path** →
  `server/railway.toml`. That file sets `buildCommand = "npm install
  --prefix server"` and `startCommand = "npm start --prefix server"` — the
  full repo is still present in the build context (Root Directory unset),
  but the commands run scoped to `server/`.
- Once a service's build/start commands come from a config-as-code file,
  the dashboard's Custom Build/Start Command fields become read-only
  (they show "value is set in ...") — that's expected, edit the file
  instead of fighting the dashboard fields.
- Railway assigns `PORT` automatically; the server already reads it from the
  environment, no config needed there.
- Railway terminates TLS for you, so the public address will be `wss://`
  even though the server itself just speaks plain `ws://` — most reverse
  proxies (including Railway's) handle this transparently.
- Once deployed, set `NEXT_PUBLIC_MULTIPLAYER_URL` on the **main site's**
  Railway service (Service → Variables) to the deployed `wss://...` address,
  then redeploy the site so Next.js inlines it at build time.

## Hardening

- `maxPayload` caps incoming WebSocket frames at 1KB — legitimate input
  messages are a few dozen bytes, so anything near that size is either a bug
  or someone trying to burn CPU/memory with oversized JSON. Connections that
  send too large a frame get closed by `ws` automatically.
- `MAX_PLAYERS` (currently 16, in `src/index.ts`) caps concurrent
  connections — without it, an attacker opening many sockets could grow
  `state.ships`/broadcast payloads unbounded and degrade the match for
  everyone. New connections beyond the cap are closed immediately with
  code 1013 ("try again later").
- `ALLOWED_ORIGINS` (env var, comma-separated, e.g.
  `https://royale.rocks,https://www.royale.rocks`) restricts which
  `Origin` header a connecting browser is allowed to present. **Opt-in** —
  unset/empty means allow any origin, so this can't silently start
  rejecting connections in an environment that hasn't configured it. Note
  this only stops casual browser-based embedding from other sites; a raw
  (non-browser) WebSocket client can send any Origin it wants, so it's not
  a substitute for real auth.
- `process.on("uncaughtException"/"unhandledRejection")` keep the process
  (and every in-progress match, since state is all in memory) alive if one
  connection triggers something unexpected, instead of one bad message
  taking the whole server down.
- The player name from the `?name=` query param is stripped of control
  characters and capped at 16 chars before being stored/broadcast.

## Known limitations (fine for now, worth knowing)

- No matchmaking/rooms — everyone who connects joins the same single arena
  (alongside any bots filling out that round).
- A dropped connection has a 15s grace window to reconnect (the client's
  existing auto-reconnect resumes the same ship via a token from the
  `welcome` message) before the ship is removed from the match for good.
- No auth/anti-cheat — inputs (rotate/thrust/fire) are trusted as sent, so a
  modified client could in principle send impossible input combinations.
  There's no position/velocity report from the client though — the server
  computes all of that itself from trusted physics constants — so this is
  limited to "always firing/thrusting," not teleporting or god-mode. Fine
  for a casual prototype, not fine if this becomes a public competitive
  product with real stakes.
