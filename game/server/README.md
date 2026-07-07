# Asteroids Royale multiplayer server

An authoritative WebSocket server for real-time PvP. It reuses the exact same
gameplay logic as the client (`stepSimulation` in `../src/simulation.ts`, plus
`entities.ts` / `zone.ts` / `vector.ts`) via relative imports, so there is only
ever one copy of the physics/collision code to maintain.

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
memory) — it is **not** a serverless/request-response service like the
Next.js site. It needs its own always-on host.

## Running locally

```bash
cd game/server
npm install
npm run dev      # tsx watch, restarts on file changes
# or: npm start   # same thing without the file watcher
```

Listens on `PORT` (env var), defaulting to `8080`.

Then point the game client at it: from `/game`, set `VITE_MULTIPLAYER_URL=ws://localhost:8080`
(this is already the default) and run `npm run dev` there too.

## Deploying (e.g. on Railway)

- This needs to be a **separate service** from the Next.js website — it's a
  long-running process holding in-memory game state, not something that fits
  a serverless/edge function model.
- Suggested Railway setup: add a new service in the same project, set its
  **root directory** to `game/server` (Railway still checks out the whole
  repo; this just changes where build/start commands run from — the
  `../../src/...` relative imports into `/game/src` still resolve on disk).
  Build command `npm install`, start command `npm start`.
- Railway assigns `PORT` automatically; the server already reads it from the
  environment, no config needed there.
- Railway terminates TLS for you, so the public address will be `wss://` even
  though the server itself just speaks plain `ws://` — most reverse proxies
  (including Railway's) handle this transparently.
- Once deployed, set the game client's `VITE_MULTIPLAYER_URL` build-time env
  var to the deployed `wss://...` address (wherever the game client itself
  ends up hosted/built).

## Known limitations (fine for now, worth knowing)

- No matchmaking/rooms — everyone who connects joins the same single arena.
- No reconnection token — a dropped connection means rejoining as a new ship
  (the client auto-reconnects the socket, but you lose your old ship's
  progress in that match).
- No auth/anti-cheat — inputs are trusted as sent. Fine for a casual
  prototype, not fine if this becomes a public competitive product.
