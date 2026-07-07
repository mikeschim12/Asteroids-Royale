# royale.rocks

A battle royale twist on classic Asteroids: shrinking safe zone, PvP ship combat, and asteroid hazards.

## Repo layout

- `/game` — the game client (Vite + TypeScript, Canvas rendering). Playable now against AI bots; real-time multiplayer networking is planned but not yet built.

Infrastructure and web access layer live outside `/game` to avoid overlap with game code.

## Running the game locally

```
cd game
npm install
npm run dev
```

Controls: arrow keys / WASD to move, Space to fire.
