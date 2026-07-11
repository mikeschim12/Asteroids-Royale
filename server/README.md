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
- No bots fill empty slots yet — this is pure human-vs-human for now.

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
- Set the build/start commands directly in the dashboard instead of via a
  committed `railway.toml` in `server/`: **Settings → Build → Custom Build
  Command** → `npm install --prefix server`, **Settings → Deploy → Custom
  Start Command** → `npm start --prefix server`. (A nested `railway.toml`
  under `server/` gets auto-discovered by Nixpacks and misapplied as the
  app source directory itself, producing a `Not a directory` build error —
  avoid that by not adding one; only the root `railway.toml`, which the
  main site's service uses, should exist in this repo.)
- The full repo is present in the build context (Root Directory unset), but
  `--prefix server` scopes both commands to run from inside `server/`.
- Railway assigns `PORT` automatically; the server already reads it from the
  environment, no config needed there.
- Railway terminates TLS for you, so the public address will be `wss://`
  even though the server itself just speaks plain `ws://` — most reverse
  proxies (including Railway's) handle this transparently.
- Once deployed, set `NEXT_PUBLIC_MULTIPLAYER_URL` on the **main site's**
  Railway service (Service → Variables) to the deployed `wss://...` address,
  then redeploy the site so Next.js inlines it at build time.

## Known limitations (fine for now, worth knowing)

- No matchmaking/rooms — everyone who connects joins the same single arena.
- No reconnection token — a dropped connection means rejoining as a new ship
  (the client auto-reconnects the socket, but you lose your old ship's
  progress in that match).
- No auth/anti-cheat — inputs are trusted as sent. Fine for a casual
  prototype, not fine if this becomes a public competitive product.
