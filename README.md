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

- `src/app/play/page.tsx` renders `<GameCanvas />` at `/play`.

The prototype (ship movement, AI bots, shrinking zone, asteroids,
particles, screen shake, procedural audio, starfield) lives in `src/game/`
as plain modules (`entities.ts`, `bot.ts`, `vector.ts`, `zone.ts`,
`starfield.ts`, `sound.ts`, `input.ts`, `simulation.ts`) with `engine.ts`
wiring them up behind `startGame`. It's folded in from the standalone Vite
prototype so the game runs inside the Next.js canvas without a second
build/dev setup — logic is otherwise unchanged.

### Real-time multiplayer

`/play` now has a mode toggle (press M) between **Local (vs Bots)** and
**Online (PvP)**. Online mode connects to a separate WebSocket server —
see `server/README.md` for how it works and how to run/deploy it. The
client reads its address from `NEXT_PUBLIC_MULTIPLAYER_URL` (defaults to
`ws://localhost:8080` if unset), which needs to be set to the deployed
server's `wss://...` address for online mode to work in production.

## Auth

Sign-in is optional — the game at `/play` is public. Auth (Google, via
[Auth.js](https://authjs.dev)) exists so a signed-in identity is available
for future features like saved scores and a leaderboard; nothing currently
requires being signed in.

- `src/auth.ts` — Auth.js config (Google provider).
- `src/app/api/auth/[...nextauth]/route.ts` — auth route handler.
- `src/app/signin/page.tsx` — sign-in page.
- `src/components/AuthStatus.tsx` — header sign in/out UI (server component).

Copy `.env.example` to `.env.local` and fill in:

```bash
AUTH_SECRET=      # npx auth secret
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

Create the Google OAuth client at the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
with authorized redirect URIs for both:
- `http://localhost:3000/api/auth/callback/google`
- `https://royale.rocks/api/auth/callback/google`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in auth values, see above
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page and
[http://localhost:3000/play](http://localhost:3000/play) for the game.

## Deployment

Deploys to [Railway](https://railway.app) using `railway.toml`
(Nixpacks build, `npm run build` / `npm run start`). Railway auto-assigns
`PORT`, which `next start` picks up automatically.

Live at **[royale.rocks](https://royale.rocks)**.

Set these as Railway environment variables (Service → Variables):

```
AUTH_SECRET=      # npx auth secret
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

### Custom domain (royale.rocks, DNS on Cloudflare)

1. **Railway**: Service → Settings → Networking → Custom Domain → add
   `royale.rocks` (and `www.royale.rocks` if you want the `www` variant).
   Railway will show a `CNAME` target like `xxxx.up.railway.app`.
2. **Cloudflare**: DNS → add a `CNAME` record:
   - Name: `@` (root) — Cloudflare supports CNAME flattening at the apex
   - Target: the Railway CNAME target from step 1
   - Proxy status: **DNS only** (grey cloud) at first, so Railway can
     issue the TLS certificate. You can switch it to proxied (orange
     cloud) afterward once the domain is verified in Railway.
   - Repeat for `www` pointing at the same target if you added it.
3. Wait for Railway to show the domain as **Active**/verified (DNS
   propagation is usually minutes, occasionally longer).
4. Add `https://royale.rocks/api/auth/callback/google` as an authorized
   redirect URI on the Google OAuth client (see Auth section above).
