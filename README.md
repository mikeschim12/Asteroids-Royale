# Asteroids Royale

A battle-royale twist on the arcade classic, built as a Next.js site with an
in-browser game.

## Who owns what

- **Website / infrastructure** (this scaffold, `/`, `/play` shell, deploy
  config): owned here.
- **Game mechanics** (the actual gameplay, physics, rendering logic): owned
  by the game side of the project.

Both sides work in this same repo — please keep changes scoped to your area
and coordinate before touching shared files (`src/game/engine.ts`'s exported
signature, `src/components/GameCanvas.tsx`, `railway.toml`).

## Integration contract

The site mounts the game through a single, small contract so either side can
work independently:

- `src/game/engine.ts` exports:

  ```ts
  export type StopGame = () => void;
  export function startGame(canvas: HTMLCanvasElement): StopGame;
  ```

  `startGame` receives a sized `<canvas>` element and should start the game
  loop against it. It must return a cleanup function that stops the loop
  (used on unmount / hot reload).

- `src/components/GameCanvas.tsx` is a client component that creates the
  canvas, keeps it sized to its container, and calls `startGame` /
  the returned stop function. It should not need to change as the game
  engine grows — extend `engine.ts` (and whatever modules it imports)
  instead of this component.

- `src/app/play/page.tsx` renders `<GameCanvas />` at `/play`. Currently
  `engine.ts` contains a placeholder animation; swap in the real game loop
  there (feel free to break it into more files/modules under `src/game/`).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page and
[http://localhost:3000/play](http://localhost:3000/play) for the game.

## Deployment

Deploys to [Railway](https://railway.app) using `railway.toml`
(Nixpacks build, `npm run build` / `npm run start`). Railway auto-assigns
`PORT`, which `next start` picks up automatically — no extra config needed.
