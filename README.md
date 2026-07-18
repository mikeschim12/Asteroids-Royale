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

**Still needed to go live**: deploy `server/` as its own always-on Railway
service, then set `NEXT_PUBLIC_MULTIPLAYER_URL` on the site's Railway
service to that server's `wss://...` address and redeploy. Until then,
online mode connects, fails gracefully, and shows a retry/local-play
prompt — it doesn't break anything, it just has nothing to talk to yet.

## Auth

Sign-in is optional — the game at `/play` is public. Auth (Google, via
[Auth.js](https://authjs.dev)) exists so a signed-in identity is available
for the leaderboard (see below) and other future features; nothing else
currently requires being signed in.

- `src/auth.ts` — Auth.js config (Google provider). The `session` callback
  puts the account's stable id (JWT `sub`) on `session.user.id`, since the
  default session shape only has name/email/image.
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

## Leaderboard

`/leaderboard` shows each signed-in account's best score from an online
PvP match (local vs-bots scores aren't recorded — only the multiplayer
server, not the browser, is trusted to report a score, since a modified
client could otherwise self-report anything).

- `prisma/schema.prisma` — one `Score` model (userId, name, score,
  createdAt). Requires a Postgres `DATABASE_URL`; the app won't start
  without one configured (see `src/lib/prisma.ts`). Uses Prisma 7's driver
  adapters (`@prisma/adapter-pg`) — the connection string lives in
  `DATABASE_URL`/`prisma.config.ts` for the CLI, not in `schema.prisma`
  itself, and the generated client goes to `src/generated/prisma`
  (gitignored, rebuilt by the `postinstall` script / `npm run db:push`).
- `src/lib/shared-secret.ts` — a small HMAC sign/verify helper with no
  Next.js-specific imports, shared between the site and `server/` the same
  way `src/game/*` already is (see server/README.md). Backs both pieces
  below.
- `src/app/api/multiplayer/token` — mints a short-lived token proving a
  signed-in identity, fetched by the client (`src/game/engine.ts`) before
  connecting to online mode and sent as `?playToken=`. Returns
  `{ token: null }` if not signed in or `MULTIPLAYER_SHARED_SECRET` isn't
  set — online play still works, the match just won't be scored.
- `server/src/index.ts` verifies that token to attribute a ship to an
  account, then POSTs final scores to `src/app/api/scores/submit` (signed
  with the same shared secret) once a round ends.

Required env vars (in addition to the Auth ones above), set on **both**
the site's and the multiplayer server's Railway services:

```bash
DATABASE_URL=               # Postgres connection string (site only)
MULTIPLAYER_SHARED_SECRET=  # any long random string, e.g. `openssl rand -hex 32`
SCORES_SUBMIT_URL=          # https://<site>/api/scores/submit (server only)
```

To provision the schema against a real database: `DATABASE_URL=... npm
run db:push` (uses `prisma db push`, no separate migration files —
fine for this project's size; switch to `prisma migrate` if that ever
matters).

## Security

- `src/proxy.ts` (Next 16 renamed "middleware" to "proxy" — same thing) sets
  a per-request, nonce-based Content-Security-Policy plus
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, and a restrictive `Permissions-Policy` on every
  response. The nonce is real per-request randomness (not a static value),
  and Next automatically applies it to the inline scripts it injects for
  hydration, so `script-src` doesn't need `'unsafe-inline'`.
- The multiplayer server (`server/`) caps message size and concurrent
  connections, has an opt-in Origin allowlist, and won't crash the whole
  process (and every in-progress match) on an unexpected error from one
  connection — see `server/README.md`'s Hardening section for specifics.
- Auth: `trustHost: true` is required behind Railway's reverse proxy (see
  `src/auth.ts`) — Auth.js still validates the OAuth state/PKCE flow itself,
  this only affects how it resolves the callback host.
- No secrets are committed — `.env.example` documents required variables
  with empty values; real values live only in `.env.local` (gitignored) and
  Railway's environment variables.

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
DATABASE_URL=     # from the Postgres plugin, for the leaderboard -- see below
MULTIPLAYER_SHARED_SECRET=  # also set on the multiplayer server's service, see below
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
