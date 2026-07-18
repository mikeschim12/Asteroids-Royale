import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createShip, Ship } from "../../src/game/entities";
import { GameState, ShipIntent, SimEvent, createInitialGameState, stepSimulation, randomSpawnPos, checkWinCondition } from "../../src/game/simulation";
import { computeBotIntent } from "../../src/game/bot";
import { signPayload, verifyPayload } from "../../src/lib/shared-secret";
import { sanitizeName } from "../../src/lib/nameFilter";

const PORT = Number(process.env.PORT) || 8080;
const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 900;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 16;
// Rounds start with at least this many ships -- bots fill any empty seats
// so a lone player doesn't have to wait for a second human to show up.
const BOT_FILL_TARGET = 4;
const BOT_DIFFICULTY_MULTIPLIER = 1;
const BOT_NAMES = ["Nova", "Rango", "Vex", "Talon", "Pixel", "Rook", "Zephyr", "Comet"];
// How long a disconnected player's ship stays in the match, controllable
// again if they reconnect with their token, before it's removed for good.
const RECONNECT_GRACE_MS = 15000;
// Legitimate input messages are a handful of bytes; anything near this size
// is either a bug or someone trying to burn CPU/memory on JSON.parse.
const MAX_MESSAGE_BYTES = 1024;
// Comma-separated list of allowed Origin header values, e.g.
// "https://royale.rocks,https://www.royale.rocks". Unset/empty means
// allow any origin -- opt-in so this can't silently start rejecting
// connections in an environment that hasn't configured it.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const PLAYER_COLORS = ["#ff5d5d", "#5da8ff", "#ffe45d", "#c65dff", "#5dffb0", "#ff9d4d", "#5dffff", "#ff5dc6", "#7fffd4"];

// Shared with the site (see src/app/api/multiplayer/token and
// src/app/api/scores/submit) so a signed-in browser can prove its identity
// here, and this server can report final scores back authoritatively.
// Both unset (default) means: online play works, scores just aren't recorded.
const MULTIPLAYER_SHARED_SECRET = process.env.MULTIPLAYER_SHARED_SECRET;
const SCORES_SUBMIT_URL = process.env.SCORES_SUBMIT_URL;

interface PlayerMeta {
  name: string;
  color: string;
  token: string;
  /** Signed-in account id, if the connecting browser proved one via ?playToken=. */
  userId?: string;
}

const NEUTRAL_INTENT: ShipIntent = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };

let nextShipId = 0;
const sockets = new Map<number, WebSocket>();
const playerMeta = new Map<number, PlayerMeta>();
const intents = new Map<number, ShipIntent>();
const tokenToShipId = new Map<string, number>();
const pendingDisconnects = new Map<number, ReturnType<typeof setTimeout>>();

function makeWaitingState(): GameState {
  const s = createInitialGameState(ARENA_WIDTH, ARENA_HEIGHT, []);
  s.scene = "waiting";
  return s;
}

let state: GameState = makeWaitingState();
let roundScoresSubmitted = false;

/**
 * Reports final scores for signed-in players once a round ends, to
 * src/app/api/scores/submit (the site's own API, a separate Railway
 * service -- see server/README.md). Best-effort: no secret/endpoint
 * configured, or the request fails, just means this round's scores don't
 * show up on the leaderboard -- online play itself is unaffected.
 */
function maybeSubmitScores() {
  if (state.scene !== "gameover" || roundScoresSubmitted) return;
  roundScoresSubmitted = true;
  if (!MULTIPLAYER_SHARED_SECRET || !SCORES_SUBMIT_URL) return;

  const results = state.ships
    .filter((s) => !s.isBot)
    .map((s) => ({ userId: playerMeta.get(s.id)?.userId, name: s.name, score: s.score }))
    .filter((r): r is { userId: string; name: string; score: number } => !!r.userId);
  if (results.length === 0) return;

  const token = signPayload({ results }, MULTIPLAYER_SHARED_SECRET, 30);
  fetch(SCORES_SUBMIT_URL, { method: "POST", body: token }).catch((err) => {
    console.error("Failed to submit scores:", err);
  });
}

function resetRound() {
  roundScoresSubmitted = false;
  const ships: Ship[] = [];
  for (const [id, meta] of playerMeta) {
    ships.push(createShip(id, randomSpawnPos(ARENA_WIDTH, ARENA_HEIGHT), { name: meta.name, color: meta.color }));
  }

  // Fill empty seats with bots so a lone player isn't stuck waiting for a
  // second human -- bot ids are negative to never collide with real ship
  // ids, and only exist for this round (not tracked in playerMeta/sockets).
  const botsNeeded = Math.max(0, BOT_FILL_TARGET - ships.length);
  for (let i = 0; i < botsNeeded; i++) {
    const botId = -(i + 1);
    const color = PLAYER_COLORS[(ships.length + i) % PLAYER_COLORS.length];
    ships.push(
      createShip(botId, randomSpawnPos(ARENA_WIDTH, ARENA_HEIGHT), {
        isBot: true,
        name: BOT_NAMES[i % BOT_NAMES.length],
        color,
      })
    );
  }

  state = createInitialGameState(ARENA_WIDTH, ARENA_HEIGHT, ships);
}

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: (info, cb) => {
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(info.origin)) {
      cb(true);
    } else {
      cb(false, 403, "Forbidden origin");
    }
  },
});

function nameFromRequestUrl(url: string | undefined, fallback: string): string {
  try {
    const requested = new URL(url ?? "", "http://localhost").searchParams.get("name") ?? "";
    // The real enforcement point: a raw (non-browser) WebSocket client can
    // send any ?name= it wants, bypassing the client-side check in
    // nameEntry.ts entirely -- this is what actually stops it from landing
    // on every other player's screen.
    const cleaned = sanitizeName(requested);
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

wss.on("connection", (ws, req) => {
  const params = (() => {
    try {
      return new URL(req.url ?? "", "http://localhost").searchParams;
    } catch {
      return new URLSearchParams();
    }
  })();
  const requestedToken = params.get("token");
  const userId =
    MULTIPLAYER_SHARED_SECRET && params.get("playToken")
      ? verifyPayload<{ sub: string }>(params.get("playToken")!, MULTIPLAYER_SHARED_SECRET)?.sub
      : undefined;
  const reconnectShipId = requestedToken ? tokenToShipId.get(requestedToken) : undefined;
  const pending = reconnectShipId !== undefined ? pendingDisconnects.get(reconnectShipId) : undefined;

  let shipId: number;
  let meta: PlayerMeta;

  if (reconnectShipId !== undefined && pending !== undefined) {
    // Reconnecting within the grace window -- resume the same ship.
    clearTimeout(pending);
    pendingDisconnects.delete(reconnectShipId);
    shipId = reconnectShipId;
    meta = playerMeta.get(shipId)!;
  } else {
    if (sockets.size >= MAX_PLAYERS) {
      ws.close(1013, "Server full");
      return;
    }
    shipId = nextShipId++;
    const name = nameFromRequestUrl(req.url, `Player ${shipId + 1}`);
    const token = randomUUID();
    meta = { name, color: PLAYER_COLORS[shipId % PLAYER_COLORS.length], token, userId };
    playerMeta.set(shipId, meta);
    tokenToShipId.set(token, shipId);
    intents.set(shipId, { ...NEUTRAL_INTENT });
  }

  sockets.set(shipId, ws);

  ws.send(
    JSON.stringify({ type: "welcome", yourShipId: shipId, worldWidth: ARENA_WIDTH, worldHeight: ARENA_HEIGHT, token: meta.token })
  );

  // Join mid-round if a match is already underway and this ship isn't
  // already in it (e.g. a reconnect within the grace window); otherwise the
  // tick loop will start a fresh round once enough players are connected.
  if (state.scene === "playing" && !state.ships.some((s) => s.id === shipId)) {
    state.ships.push(createShip(shipId, randomSpawnPos(ARENA_WIDTH, ARENA_HEIGHT), { name: meta.name, color: meta.color }));
  }

  ws.on("message", (data) => {
    let msg: unknown;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as Record<string, unknown>;
    if (m.type === "input") {
      intents.set(shipId, {
        rotateLeft: !!m.rotateLeft,
        rotateRight: !!m.rotateRight,
        thrust: !!m.thrust,
        fire: !!m.fire,
      });
    }
  });

  ws.on("close", () => {
    // Only tear down if this socket is still the one on record for the
    // ship -- a reconnect may have already replaced it.
    if (sockets.get(shipId) !== ws) return;
    sockets.delete(shipId);
    // Stop the ship from coasting on its last input while disconnected.
    intents.set(shipId, { ...NEUTRAL_INTENT });

    const timer = setTimeout(() => {
      pendingDisconnects.delete(shipId);
      tokenToShipId.delete(meta.token);
      playerMeta.delete(shipId);
      intents.delete(shipId);
      const idx = state.ships.findIndex((s) => s.id === shipId);
      if (idx !== -1) {
        state.ships.splice(idx, 1);
        checkWinCondition(state);
        maybeSubmitScores();
      }
    }, RECONNECT_GRACE_MS);
    pendingDisconnects.set(shipId, timer);
  });

  ws.on("error", () => {
    // 'close' fires after 'error' for the same socket; cleanup happens there.
  });
});

function broadcast(events: SimEvent[]) {
  const payload = JSON.stringify({
    type: "state",
    state,
    events,
    connectedCount: sockets.size,
  });
  for (const ws of sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

setInterval(() => {
  let events: SimEvent[] = [];

  if (state.scene === "waiting") {
    if (sockets.size >= MIN_PLAYERS) resetRound();
  } else if (state.scene === "gameover") {
    state.restartCooldown = Math.max(0, state.restartCooldown - DT);
    if (state.restartCooldown === 0) {
      if (sockets.size >= MIN_PLAYERS) resetRound();
      else state.scene = "waiting";
    }
  } else if (state.scene === "playing") {
    const tickIntents = new Map<number, ShipIntent>();
    for (const ship of state.ships) {
      if (!ship.alive) continue;
      if (ship.isBot) {
        tickIntents.set(
          ship.id,
          computeBotIntent(ship, state.ships, state.asteroids, state.bullets, state.pickups, state.zone, BOT_DIFFICULTY_MULTIPLIER)
        );
      } else {
        tickIntents.set(ship.id, intents.get(ship.id) ?? NEUTRAL_INTENT);
      }
    }
    events = stepSimulation(state, tickIntents, DT);
    maybeSubmitScores();
  }

  broadcast(events);
}, DT * 1000);

console.log(`Asteroids Royale multiplayer server listening on ws://localhost:${PORT}`);

// This process holds every active match's state in memory -- one uncaught
// exception (e.g. from a malformed message we didn't anticipate) shouldn't
// take the whole server, and everyone's match, down with it.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (server staying up):", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (server staying up):", err);
});
