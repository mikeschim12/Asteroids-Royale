import { WebSocketServer, WebSocket } from "ws";
import { createShip, Ship } from "../../src/game/entities";
import { GameState, ShipIntent, SimEvent, createInitialGameState, stepSimulation, randomSpawnPos, checkWinCondition } from "../../src/game/simulation";

const PORT = Number(process.env.PORT) || 8080;
const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 900;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 16;
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

interface PlayerMeta {
  name: string;
  color: string;
}

let nextShipId = 0;
const sockets = new Map<number, WebSocket>();
const playerMeta = new Map<number, PlayerMeta>();
const intents = new Map<number, ShipIntent>();

function makeWaitingState(): GameState {
  const s = createInitialGameState(ARENA_WIDTH, ARENA_HEIGHT, []);
  s.scene = "waiting";
  return s;
}

let state: GameState = makeWaitingState();

function resetRound() {
  const ships: Ship[] = [];
  for (const [id, meta] of playerMeta) {
    ships.push(createShip(id, randomSpawnPos(ARENA_WIDTH, ARENA_HEIGHT), { name: meta.name, color: meta.color }));
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
    const requested = new URL(url ?? "", "http://localhost").searchParams.get("name")?.trim();
    // Strip control/formatting characters -- defense in depth against
    // anything downstream (logs, future UI) that might not expect them.
    const cleaned = requested?.replace(/[\x00-\x1f\x7f]/g, "");
    return cleaned ? cleaned.slice(0, 16) : fallback;
  } catch {
    return fallback;
  }
}

wss.on("connection", (ws, req) => {
  if (sockets.size >= MAX_PLAYERS) {
    ws.close(1013, "Server full");
    return;
  }

  const shipId = nextShipId++;
  const name = nameFromRequestUrl(req.url, `Player ${shipId + 1}`);
  const meta: PlayerMeta = { name, color: PLAYER_COLORS[shipId % PLAYER_COLORS.length] };
  playerMeta.set(shipId, meta);
  sockets.set(shipId, ws);
  intents.set(shipId, { rotateLeft: false, rotateRight: false, thrust: false, fire: false });

  ws.send(JSON.stringify({ type: "welcome", yourShipId: shipId, worldWidth: ARENA_WIDTH, worldHeight: ARENA_HEIGHT }));

  // Join mid-round if a match is already underway; otherwise the tick loop
  // will start a fresh round once enough players are connected.
  if (state.scene === "playing") {
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
    sockets.delete(shipId);
    playerMeta.delete(shipId);
    intents.delete(shipId);
    const idx = state.ships.findIndex((s) => s.id === shipId);
    if (idx !== -1) {
      state.ships.splice(idx, 1);
      checkWinCondition(state);
    }
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
      tickIntents.set(ship.id, intents.get(ship.id) ?? { rotateLeft: false, rotateRight: false, thrust: false, fire: false });
    }
    events = stepSimulation(state, tickIntents, DT);
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
