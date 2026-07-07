import { InputState } from "./input";
import { Starfield } from "./starfield";
import { TouchControls } from "./touchControls";
import { computeBotIntent } from "./bot";
import { NetworkClient } from "./net";
import * as sound from "./sound";
import { Ship, Asteroid, Particle, Pickup, createShip, spawnExplosion, PICKUP_RADIUS } from "./entities";
import { GameState, Scene, ShipIntent, SimEvent, createInitialGameState, stepSimulation, randomSpawnPos } from "./simulation";
import { add, scale, fromAngle } from "./vector";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const starfield = new Starfield(window.innerWidth, window.innerHeight);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  starfield.regenerate(canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();

const input = new InputState();
const touchControls = new TouchControls();

const BOT_COLORS = ["#ff5d5d", "#5da8ff", "#ffe45d", "#c65dff", "#5dffb0", "#ff9d4d", "#5dffff", "#ff5dc6"];
const MIN_BOTS = 2;
const MAX_BOTS = 8;
const DIFFICULTIES: { label: string; multiplier: number }[] = [
  { label: "Easy", multiplier: 0.7 },
  { label: "Normal", multiplier: 1.0 },
  { label: "Hard", multiplier: 1.3 },
];
const MULTIPLAYER_URL = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_MULTIPLAYER_URL ?? "ws://localhost:8080";

let selectedBotCount = 5;
let selectedDifficultyIndex = 1;
let mode: "local" | "online" = "local";

// --- Local (single-device, vs bots) mode state ---
let uiScene: Scene = "start";
let state: GameState;
let playerShip: Ship;

// --- Online (real multiplayer) mode state ---
type OnlineStatus = "idle" | "connecting" | "connected" | "error";
let onlineStatus: OnlineStatus = "idle";
let netClient: NetworkClient | null = null;
let onlineState: GameState | null = null;
let onlineConnectedCount = 0;
let onlineYourId = -1;

// --- Shared client-only cosmetics ---
let particles: Particle[] = [];
let shakeTime = 0;
let shakeMagnitude = 0;
let thrustSoundCooldown = 0;

function shake(magnitude: number, duration: number) {
  shakeMagnitude = Math.max(shakeMagnitude, magnitude);
  shakeTime = Math.max(shakeTime, duration);
}

function spawnThrustParticle(ship: Ship) {
  const behind = ship.angle + Math.PI;
  particles.push({
    pos: add(ship.pos, scale(fromAngle(behind), ship.radius * 0.8)),
    vel: add(scale(ship.vel, 0.3), scale(fromAngle(behind + (Math.random() - 0.5) * 0.6), 60)),
    ttl: 0.25,
    maxTtl: 0.25,
    color: "#ff9d4d",
    radius: 2,
  });
}

function applySimEvents(events: SimEvent[], myShipId: number) {
  for (const event of events) {
    if (event.type === "shipExplosion") {
      particles.push(...spawnExplosion(event.pos, event.color, 24));
      sound.playExplosion(3);
      if (event.shipId === myShipId) shake(10, 0.4);
    } else if (event.type === "asteroidExplosion") {
      particles.push(...spawnExplosion(event.pos, "#ccc", 12));
      sound.playExplosion(event.size);
      shake(event.size * 1.5, 0.15);
    } else if (event.type === "hit") {
      sound.playHit();
      if (event.shipId === myShipId) shake(6, 0.2);
    } else if (event.type === "pickup") {
      sound.playPickup();
    }
  }
}

function resetGame() {
  let nextShipId = 0;
  playerShip = createShip(nextShipId++, { x: canvas.width / 2, y: canvas.height / 2 }, { name: "You", color: "#7fffd4" });
  const ships = [playerShip];
  for (let i = 0; i < selectedBotCount; i++) {
    ships.push(
      createShip(nextShipId++, randomSpawnPos(canvas.width, canvas.height), {
        isBot: true,
        name: `Bot ${i + 1}`,
        color: BOT_COLORS[i % BOT_COLORS.length],
      })
    );
  }
  state = createInitialGameState(canvas.width, canvas.height, ships);
  particles = [];
  uiScene = "playing";
}

function connectOnline() {
  if (onlineStatus === "connecting" || onlineStatus === "connected") return;
  onlineStatus = "connecting";
  particles = [];
  netClient = new NetworkClient();
  netClient.connect(MULTIPLAYER_URL, {
    onWelcome(yourShipId) {
      onlineYourId = yourShipId;
      onlineStatus = "connected";
    },
    onState(newState, events, connectedCount) {
      const prevBullets = onlineState ? onlineState.bullets.filter((b) => b.ownerId === onlineYourId).length : 0;
      const nextBullets = newState.bullets.filter((b) => b.ownerId === onlineYourId).length;
      if (nextBullets > prevBullets) sound.playFire();

      for (const ship of newState.ships) {
        if (!ship.alive || !ship.thrusting) continue;
        spawnThrustParticle(ship);
        if (ship.id === onlineYourId) {
          thrustSoundCooldown = Math.max(0, thrustSoundCooldown - 0.05);
          if (thrustSoundCooldown === 0) {
            sound.playThrust();
            thrustSoundCooldown = 0.1;
          }
        }
      }

      applySimEvents(events, onlineYourId);
      onlineState = newState;
      onlineConnectedCount = connectedCount;
    },
    onClose() {
      onlineStatus = "idle";
      onlineState = null;
      netClient = null;
    },
    onError() {
      onlineStatus = "error";
    },
  });
}

let lastTime = performance.now();

function updateLocal(dt: number) {
  if (uiScene === "start") {
    if (input.consumeJustPressed("ArrowLeft") || input.consumeJustPressed("KeyA")) {
      selectedBotCount = Math.max(MIN_BOTS, selectedBotCount - 1);
    }
    if (input.consumeJustPressed("ArrowRight") || input.consumeJustPressed("KeyD")) {
      selectedBotCount = Math.min(MAX_BOTS, selectedBotCount + 1);
    }
    if (input.consumeJustPressed("ArrowUp") || input.consumeJustPressed("KeyW")) {
      selectedDifficultyIndex = Math.min(DIFFICULTIES.length - 1, selectedDifficultyIndex + 1);
    }
    if (input.consumeJustPressed("ArrowDown") || input.consumeJustPressed("KeyS")) {
      selectedDifficultyIndex = Math.max(0, selectedDifficultyIndex - 1);
    }
    if (input.fire) {
      sound.resumeAudio();
      resetGame();
    }
    return;
  }

  if (uiScene === "gameover") {
    state.restartCooldown = Math.max(0, state.restartCooldown - dt);
    if (state.restartCooldown === 0 && input.fire) {
      resetGame();
    }
    return;
  }

  const intents = new Map<number, ShipIntent>();
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    if (ship.isBot) {
      intents.set(
        ship.id,
        computeBotIntent(ship, state.ships, state.asteroids, state.bullets, state.pickups, state.zone, DIFFICULTIES[selectedDifficultyIndex].multiplier)
      );
    } else {
      intents.set(ship.id, { rotateLeft: input.rotateLeft, rotateRight: input.rotateRight, thrust: input.thrust, fire: input.fire });
    }
  }

  const playerBulletsBefore = state.bullets.filter((b) => b.ownerId === playerShip.id).length;
  const events = stepSimulation(state, intents, dt);
  const playerBulletsAfter = state.bullets.filter((b) => b.ownerId === playerShip.id).length;
  if (playerBulletsAfter > playerBulletsBefore) sound.playFire();

  for (const ship of state.ships) {
    if (!ship.alive || !ship.thrusting) continue;
    spawnThrustParticle(ship);
    if (ship === playerShip) {
      thrustSoundCooldown = Math.max(0, thrustSoundCooldown - dt);
      if (thrustSoundCooldown === 0) {
        sound.playThrust();
        thrustSoundCooldown = 0.1;
      }
    }
  }

  applySimEvents(events, playerShip.id);

  uiScene = state.scene;
}

function updateOnline() {
  if (onlineStatus === "idle") {
    if (input.fire) {
      sound.resumeAudio();
      connectOnline();
    }
    return;
  }
  if (onlineStatus !== "connected" || !onlineState) return;

  // The server drives match restarts on its own timer; the client just
  // keeps streaming input regardless of scene (waiting/playing/gameover).
  netClient?.sendInput({ rotateLeft: input.rotateLeft, rotateRight: input.rotateRight, thrust: input.thrust, fire: input.fire });
}

function update(dt: number) {
  shakeTime = Math.max(0, shakeTime - dt);
  if (shakeTime === 0) shakeMagnitude = 0;

  const canSwitchMode = (mode === "local" && uiScene === "start") || (mode === "online" && (onlineStatus === "idle" || onlineStatus === "error"));
  if (canSwitchMode && input.consumeJustPressed("KeyM")) {
    mode = mode === "local" ? "online" : "local";
    onlineStatus = "idle";
  }

  if (mode === "local") {
    updateLocal(dt);
  } else {
    updateOnline();
  }

  for (const p of particles) {
    p.pos = add(p.pos, scale(p.vel, dt));
    p.ttl -= dt;
  }
  particles = particles.filter((p) => p.ttl > 0);
}

function drawShip(s: Ship) {
  if (s.invulnerable > 0 && Math.floor(s.invulnerable * 10) % 2 === 0) return;
  if (s.shieldTime > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(93, 168, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y, s.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(s.angle);
  if (s.thrusting) {
    ctx.strokeStyle = "#ff9d4d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.radius * 0.4, 0);
    ctx.lineTo(-s.radius * (1.1 + Math.random() * 0.4), 0);
    ctx.stroke();
  }
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s.radius, 0);
  ctx.lineTo(-s.radius * 0.8, s.radius * 0.7);
  ctx.lineTo(-s.radius * 0.4, 0);
  ctx.lineTo(-s.radius * 0.8, -s.radius * 0.7);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = s.color;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(s.name, s.pos.x, s.pos.y - s.radius - 8);
  ctx.textAlign = "left";
}

function drawAsteroid(a: Asteroid) {
  ctx.save();
  ctx.translate(a.pos.x, a.pos.y);
  ctx.rotate(a.rotation);
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = a.shape.length;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = a.radius * a.shape[i];
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

const PICKUP_COLORS: Record<Pickup["type"], string> = {
  shield: "#5da8ff",
  rapid: "#ffe45d",
  repair: "#5dffb0",
};
const PICKUP_LABELS: Record<Pickup["type"], string> = {
  shield: "S",
  rapid: "R",
  repair: "+",
};

function drawPickup(p: Pickup) {
  const fading = p.ttl < 2;
  if (fading && Math.floor(p.ttl * 6) % 2 === 0) return;
  const color = PICKUP_COLORS[p.type];
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * PICKUP_RADIUS;
    const y = Math.sin(angle) * PICKUP_RADIUS;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(PICKUP_LABELS[p.type], 0, 1);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.ttl / p.maxTtl);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStartScreen() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#7fffd4";
  ctx.font = "56px monospace";
  ctx.fillText("ROYALE.ROCKS", canvas.width / 2, canvas.height / 2 - 120);
  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.fillText("WASD / Arrows to move, Space to fire", canvas.width / 2, canvas.height / 2 - 70);

  ctx.font = "24px monospace";
  ctx.fillStyle = mode === "local" ? "#7fffd4" : "#888";
  const localLabel = mode === "local" ? "> LOCAL (vs Bots) <" : "  LOCAL (vs Bots)  ";
  ctx.fillText(localLabel, canvas.width / 2, canvas.height / 2 - 30);
  ctx.fillStyle = mode === "online" ? "#7fffd4" : "#888";
  const onlineLabel = mode === "online" ? "> ONLINE (PvP) <" : "  ONLINE (PvP)  ";
  ctx.fillText(onlineLabel, canvas.width / 2, canvas.height / 2 - 2);
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("Press M to switch mode", canvas.width / 2, canvas.height / 2 + 22);

  if (mode === "local") {
    ctx.font = "22px monospace";
    ctx.fillStyle = "#ffe45d";
    ctx.fillText(`< Bots: ${selectedBotCount} >`, canvas.width / 2, canvas.height / 2 + 56);
    ctx.fillStyle = "#5da8ff";
    ctx.fillText(`^ Difficulty: ${DIFFICULTIES[selectedDifficultyIndex].label} v`, canvas.width / 2, canvas.height / 2 + 84);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.fillText("Left/Right: bot count   Up/Down: difficulty", canvas.width / 2, canvas.height / 2 + 112);
  } else {
    ctx.font = "16px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText("Last one standing wins. Real opponents only.", canvas.width / 2, canvas.height / 2 + 60);
  }

  ctx.font = "20px monospace";
  ctx.fillStyle = "#fff";
  ctx.fillText("Press SPACE to start", canvas.width / 2, canvas.height / 2 + 150);
  ctx.textAlign = "left";
}

function drawOnlineStatusScreen() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#7fffd4";
  ctx.font = "32px monospace";
  if (onlineStatus === "connecting") {
    ctx.fillText("CONNECTING...", canvas.width / 2, canvas.height / 2);
  } else if (onlineStatus === "error") {
    ctx.fillStyle = "#ff5d5d";
    ctx.fillText("CONNECTION FAILED", canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText("Press SPACE to retry, or M for local play", canvas.width / 2, canvas.height / 2 + 36);
  } else if (onlineState?.scene === "waiting") {
    ctx.fillText("WAITING FOR OPPONENTS", canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`${onlineConnectedCount} connected -- need at least 2 to start`, canvas.width / 2, canvas.height / 2 + 36);
  }
  ctx.textAlign = "left";
}

function draw() {
  const activeScene: Scene = mode === "local" ? uiScene : onlineState?.scene ?? "start";
  touchControls.sync(onlineStatus === "connecting" || onlineStatus === "error" ? "start" : activeScene);
  ctx.save();
  if (shakeTime > 0) {
    const dx = (Math.random() - 0.5) * shakeMagnitude;
    const dy = (Math.random() - 0.5) * shakeMagnitude;
    ctx.translate(dx, dy);
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
  starfield.draw(ctx);

  if (mode === "local" && uiScene === "start") {
    drawStartScreen();
    ctx.restore();
    return;
  }
  if (mode === "online" && (onlineStatus === "idle" || onlineStatus === "connecting" || onlineStatus === "error")) {
    if (onlineStatus === "idle") drawStartScreen();
    else drawOnlineStatusScreen();
    ctx.restore();
    return;
  }

  const world = mode === "local" ? state : onlineState;
  if (!world) {
    ctx.restore();
    return;
  }
  const me = mode === "local" ? playerShip : world.ships.find((s) => s.id === onlineYourId);

  if (world.scene === "waiting") {
    drawOnlineStatusScreen();
    ctx.restore();
    return;
  }

  ctx.strokeStyle = "rgba(127, 255, 212, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(world.zone.center.x, world.zone.center.y, world.zone.radius, 0, Math.PI * 2);
  ctx.stroke();

  for (const ship of world.ships) {
    if (ship.alive) drawShip(ship);
  }

  ctx.fillStyle = "#fff";
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const a of world.asteroids) drawAsteroid(a);
  for (const p of world.pickups) drawPickup(p);
  drawParticles();

  if (me) {
    const aliveCount = world.ships.filter((s) => s.alive).length;
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`HP: ${Math.ceil(me.hp)}`, 16, 24);
    ctx.fillText(`Lives: ${me.lives}`, 16, 44);
    ctx.fillText(`Kills: ${me.kills}`, 16, 64);
    ctx.fillText(`Score: ${me.score}`, 16, 84);
    ctx.fillText(`Zone: ${Math.ceil(world.zone.radius)}`, 16, 104);
    ctx.fillText(`Alive: ${aliveCount}/${world.ships.length}`, 16, 124);
    if (me.shieldTime > 0) {
      ctx.fillStyle = "#5da8ff";
      ctx.fillText(`Shield: ${me.shieldTime.toFixed(1)}s`, 16, 144);
    }
    if (me.rapidFireTime > 0) {
      ctx.fillStyle = "#ffe45d";
      ctx.fillText(`Rapid Fire: ${me.rapidFireTime.toFixed(1)}s`, 16, me.shieldTime > 0 ? 164 : 144);
    }
  }

  if (world.scene === "gameover") {
    ctx.textAlign = "center";
    ctx.font = "48px monospace";
    const won = me ? world.winnerName === me.name : false;
    ctx.fillText(won ? "VICTORY" : "GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px monospace";
    ctx.fillText(`Winner: ${world.winnerName}`, canvas.width / 2, canvas.height / 2 + 36);
    if (me) ctx.fillText(`Kills: ${me.kills}`, canvas.width / 2, canvas.height / 2 + 60);
    if (mode === "local" && world.restartCooldown === 0) {
      ctx.fillText("Press SPACE to restart", canvas.width / 2, canvas.height / 2 + 92);
    } else if (mode === "online") {
      ctx.fillText("Next match starting soon...", canvas.width / 2, canvas.height / 2 + 92);
    }
    ctx.textAlign = "left";
  }

  ctx.restore();
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
