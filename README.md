# royale.rocks

A battle royale twist on classic Asteroids: shrinking safe zone, PvP ship combat, and asteroid hazards.

## Repo layout

- `/game` — the game client (Vite + TypeScript, Canvas rendering). Playable against AI bots (local mode) or real opponents (online mode, press M on the start screen to switch).
- `/game/server` — the multiplayer server: an authoritative Node/WebSocket process real players connect to for online mode. See `game/server/README.md` for how to run and deploy it.

Infrastructure and web access layer live outside `/game` to avoid overlap with game code.

## Running the game locally

```
cd game
npm install
npm run dev
```

Controls: arrow keys / WASD to move, Space to fire. Press M on the start screen to switch between Local (vs Bots) and Online (PvP) — online mode needs the multiplayer server running (see `game/server/README.md`), and reads its address from `VITE_MULTIPLAYER_URL` (defaults to `ws://localhost:8080`).
