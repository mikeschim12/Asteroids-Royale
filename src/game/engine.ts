import { InputState } from "./input";
import { ShrinkingZone } from "./zone";
import { Starfield } from "./starfield";
import { computeBotIntent, BotIntent } from "./bot";
import * as sound from "./sound";
import {
  Ship,
  Bullet,
  Asteroid,
  Particle,
  Pickup,
  createShip,
  spawnAsteroid,
  splitAsteroid,
  spawnExplosion,
  spawnPickup,
  SHIP_THRUST,
  SHIP_ROTATION_SPEED,
  SHIP_DRAG,
  BULLET_SPEED,
  BULLET_TTL,
  FIRE_INTERVAL,
  RESPAWN_INVULN_TIME,
  PICKUP_RADIUS,
  PICKUP_DROP_CHANCE,
  SHIELD_DURATION,
  RAPID_FIRE_DURATION,
  RAPID_FIRE_MULTIPLIER,
  REPAIR_AMOUNT,
} from "./entities";
import { add, scale, fromAngle, distance, wrap } from "./vector";

export type StopGame = () => void;

const BOT_COLORS = ["#ff5d5d", "#5da8ff", "#ffe45d", "#c65dff", "#5dffb0", "#ff9d4d", "#5dffff", "#ff5dc6"];
const MIN_BOTS = 2;
const MAX_BOTS = 8;
const DIFFICULTIES: { label: string; multiplier: number }[] = [
  { label: "Easy", multiplier: 0.7 },
  { label: "Normal", multiplier: 1.0 },
  { label: "Hard", multiplier: 1.3 },
];
const ASTEROID_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };

export function startGame(canvas: HTMLCanvasElement): StopGame {
  const ctx = canvas.getContext("2d")!;
  const starfield = new Starfield(canvas.width, canvas.height);
  const input = new InputState();

  type Scene = "start" | "playing" | "gameover";
  let scene: Scene = "start";

  let selectedBotCount = 5;
  let selectedDifficultyIndex = 1;

  let nextShipId = 0;
  let playerShip: Ship;
  let ships: Ship[];
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let pickups: Pickup[];
  let zone: ShrinkingZone;
  let restartCooldown = 0;
  let shakeTime = 0;
  let shakeMagnitude = 0;
  let thrustSoundCooldown = 0;
  let winnerName: string | null = null;

  function spawnWaveAsteroids(count: number) {
    const result: Asteroid[] = [];
    for (let i = 0; i < count; i++) {
      const edge = Math.random() < 0.5 ? 0 : canvas.width;
      result.push(spawnAsteroid({ x: edge, y: Math.random() * canvas.height }, 3));
    }
    return result;
  }

  function shake(magnitude: number, duration: number) {
    shakeMagnitude = Math.max(shakeMagnitude, magnitude);
    shakeTime = Math.max(shakeTime, duration);
  }

  function isProtected(ship: Ship): boolean {
    return ship.invulnerable > 0 || ship.shieldTime > 0;
  }

  function applyPickup(ship: Ship, type: Pickup["type"]) {
    if (type === "shield") {
      ship.shieldTime = Math.max(ship.shieldTime, SHIELD_DURATION);
    } else if (type === "rapid") {
      ship.rapidFireTime = Math.max(ship.rapidFireTime, RAPID_FIRE_DURATION);
    } else {
      ship.hp = Math.min(ship.maxHp, ship.hp + REPAIR_AMOUNT);
    }
    sound.playPickup();
  }

  function randomSpawnPos(): { x: number; y: number } {
    const margin = 100;
    return {
      x: margin + Math.random() * Math.max(1, canvas.width - margin * 2),
      y: margin + Math.random() * Math.max(1, canvas.height - margin * 2),
    };
  }

  function resetGame() {
    nextShipId = 0;
    playerShip = createShip(nextShipId++, { x: canvas.width / 2, y: canvas.height / 2 }, { name: "You", color: "#7fffd4" });
    ships = [playerShip];
    for (let i = 0; i < selectedBotCount; i++) {
      ships.push(
        createShip(nextShipId++, randomSpawnPos(), {
          isBot: true,
          name: `Bot ${i + 1}`,
          color: BOT_COLORS[i % BOT_COLORS.length],
        })
      );
    }
    bullets = [];
    asteroids = spawnWaveAsteroids(8);
    particles = [];
    pickups = [];
    scene = "playing";
    winnerName = null;
    zone = new ShrinkingZone(
      { x: canvas.width / 2, y: canvas.height / 2 },
      Math.max(canvas.width, canvas.height) * 0.6,
      140,
      1.2
    );
  }

  function killShip(ship: Ship, killerId: number | null) {
    particles.push(...spawnExplosion(ship.pos, ship.color, 24));
    sound.playExplosion(3);
    if (ship === playerShip) shake(10, 0.4);
    ship.lives -= 1;

    if (killerId !== null) {
      const killer = ships.find((s) => s.id === killerId);
      if (killer && killer.id !== ship.id) killer.kills += 1;
    }

    if (ship.lives <= 0) {
      ship.alive = false;
    } else {
      ship.pos = randomSpawnPos();
      ship.vel = { x: 0, y: 0 };
      ship.hp = ship.maxHp;
      ship.invulnerable = RESPAWN_INVULN_TIME;
    }

    const aliveShips = ships.filter((s) => s.alive);
    if (aliveShips.length <= 1 && scene === "playing") {
      scene = "gameover";
      restartCooldown = 1;
      winnerName = aliveShips.length === 1 ? aliveShips[0].name : "No one";
    }
  }

  function applyShipControl(ship: Ship, intent: { rotateLeft: boolean; rotateRight: boolean; thrust: boolean; fire: boolean }, dt: number) {
    if (intent.rotateLeft) ship.angle -= SHIP_ROTATION_SPEED * dt;
    if (intent.rotateRight) ship.angle += SHIP_ROTATION_SPEED * dt;
    if (intent.thrust) {
      const thrustVec = scale(fromAngle(ship.angle), SHIP_THRUST * dt);
      ship.vel = add(ship.vel, thrustVec);
      const behind = ship.angle + Math.PI;
      particles.push({
        pos: add(ship.pos, scale(fromAngle(behind), ship.radius * 0.8)),
        vel: add(scale(ship.vel, 0.3), scale(fromAngle(behind + (Math.random() - 0.5) * 0.6), 60)),
        ttl: 0.25,
        maxTtl: 0.25,
        color: "#ff9d4d",
        radius: 2,
      });
      if (ship === playerShip) {
        thrustSoundCooldown = Math.max(0, thrustSoundCooldown - dt);
        if (thrustSoundCooldown === 0) {
          sound.playThrust();
          thrustSoundCooldown = 0.1;
        }
      }
    }
    ship.vel = scale(ship.vel, SHIP_DRAG);
    ship.pos = wrap(add(ship.pos, scale(ship.vel, dt)), canvas.width, canvas.height);

    ship.invulnerable = Math.max(0, ship.invulnerable - dt);
    ship.shieldTime = Math.max(0, ship.shieldTime - dt);
    ship.rapidFireTime = Math.max(0, ship.rapidFireTime - dt);
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
    if (intent.fire && ship.fireCooldown === 0) {
      ship.fireCooldown = ship.rapidFireTime > 0 ? FIRE_INTERVAL * RAPID_FIRE_MULTIPLIER : FIRE_INTERVAL;
      bullets.push({
        ownerId: ship.id,
        pos: add(ship.pos, scale(fromAngle(ship.angle), ship.radius)),
        vel: add(ship.vel, scale(fromAngle(ship.angle), BULLET_SPEED)),
        ttl: BULLET_TTL,
      });
      if (ship === playerShip) sound.playFire();
    }
  }

  function update(dt: number) {
    shakeTime = Math.max(0, shakeTime - dt);
    if (shakeTime === 0) shakeMagnitude = 0;

    if (scene === "start") {
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

    if (scene === "gameover") {
      restartCooldown = Math.max(0, restartCooldown - dt);
      if (restartCooldown === 0 && input.fire) {
        resetGame();
      }
      return;
    }

    for (const ship of ships) {
      if (!ship.alive) continue;
      let intent: BotIntent;
      if (ship.isBot) {
        intent = computeBotIntent(ship, ships, asteroids, bullets, pickups, zone, DIFFICULTIES[selectedDifficultyIndex].multiplier);
      } else {
        intent = { rotateLeft: input.rotateLeft, rotateRight: input.rotateRight, thrust: input.thrust, fire: input.fire };
      }
      applyShipControl(ship, intent, dt);

      if (!isProtected(ship) && zone.isOutside(ship.pos)) {
        ship.hp -= zone.damagePerSecond * dt;
        if (ship.hp <= 0) {
          ship.hp = 0;
          killShip(ship, null);
        }
      }
    }

    zone.update(dt);

    for (const b of bullets) {
      b.pos = wrap(add(b.pos, scale(b.vel, dt)), canvas.width, canvas.height);
      b.ttl -= dt;
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].ttl <= 0) bullets.splice(i, 1);
    }

    for (const a of asteroids) {
      a.pos = wrap(add(a.pos, scale(a.vel, dt)), canvas.width, canvas.height);
      a.rotation += a.rotationSpeed * dt;
    }

    for (const p of particles) {
      p.pos = add(p.pos, scale(p.vel, dt));
      p.ttl -= dt;
    }
    particles = particles.filter((p) => p.ttl > 0);

    // Bullets vs ships
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (const ship of ships) {
        if (!ship.alive || ship.id === b.ownerId || isProtected(ship)) continue;
        if (distance(b.pos, ship.pos) < ship.radius) {
          bullets.splice(i, 1);
          ship.hp -= 34;
          sound.playHit();
          if (ship === playerShip) shake(6, 0.2);
          if (ship.hp <= 0) {
            ship.hp = 0;
            killShip(ship, b.ownerId);
          }
          break;
        }
      }
    }

    // Bullets vs asteroids
    const survivingAsteroids: Asteroid[] = [];
    for (const a of asteroids) {
      let shooterId: number | null = null;
      for (let i = bullets.length - 1; i >= 0; i--) {
        if (distance(bullets[i].pos, a.pos) < a.radius) {
          shooterId = bullets[i].ownerId;
          bullets.splice(i, 1);
          break;
        }
      }
      if (shooterId !== null) {
        const shooter = ships.find((s) => s.id === shooterId);
        if (shooter) shooter.score += ASTEROID_SCORE[a.size];
        particles.push(...spawnExplosion(a.pos, "#ccc", 12));
        sound.playExplosion(a.size);
        shake(a.size * 1.5, 0.15);
        if (Math.random() < PICKUP_DROP_CHANCE) {
          pickups.push(spawnPickup(a.pos));
        }
        survivingAsteroids.push(...splitAsteroid(a));
      } else {
        survivingAsteroids.push(a);
      }
    }
    asteroids = survivingAsteroids;

    if (asteroids.length === 0) {
      asteroids = spawnWaveAsteroids(8);
    }

    for (const p of pickups) {
      p.ttl -= dt;
    }
    pickups = pickups.filter((p) => p.ttl > 0);

    // Ships vs pickups
    for (const ship of ships) {
      if (!ship.alive) continue;
      for (let i = pickups.length - 1; i >= 0; i--) {
        if (distance(ship.pos, pickups[i].pos) < ship.radius + PICKUP_RADIUS) {
          applyPickup(ship, pickups[i].type);
          pickups.splice(i, 1);
        }
      }
    }

    // Ships vs asteroids
    for (const ship of ships) {
      if (!ship.alive || isProtected(ship)) continue;
      for (const a of asteroids) {
        if (distance(ship.pos, a.pos) < a.radius + ship.radius) {
          ship.hp -= 34;
          sound.playHit();
          if (ship === playerShip) shake(6, 0.2);
          if (ship.hp <= 0) {
            ship.hp = 0;
            killShip(ship, null);
          }
          break;
        }
      }
    }

    // Ship vs ship collision
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i];
        const b = ships[j];
        if (!a.alive || !b.alive || isProtected(a) || isProtected(b)) continue;
        if (distance(a.pos, b.pos) < a.radius + b.radius) {
          a.hp -= 20;
          b.hp -= 20;
          if (a === playerShip || b === playerShip) shake(6, 0.2);
          if (a.hp <= 0) {
            a.hp = 0;
            killShip(a, b.id);
          }
          if (b.hp <= 0) {
            b.hp = 0;
            killShip(b, a.id);
          }
        }
      }
    }
  }

  function drawShip(s: Ship, isThrusting: boolean) {
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
    if (isThrusting) {
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

    if (s.isBot) {
      ctx.fillStyle = s.color;
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(s.name, s.pos.x, s.pos.y - s.radius - 8);
      ctx.textAlign = "left";
    }
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
    ctx.fillText("ROYALE.ROCKS", canvas.width / 2, canvas.height / 2 - 100);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText("WASD / Arrows to move, Space to fire", canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillText("Last one standing wins", canvas.width / 2, canvas.height / 2 - 26);

    ctx.font = "22px monospace";
    ctx.fillStyle = "#ffe45d";
    ctx.fillText(`< Bots: ${selectedBotCount} >`, canvas.width / 2, canvas.height / 2 + 24);
    ctx.fillStyle = "#5da8ff";
    ctx.fillText(`^ Difficulty: ${DIFFICULTIES[selectedDifficultyIndex].label} v`, canvas.width / 2, canvas.height / 2 + 54);

    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.fillText("Left/Right: bot count   Up/Down: difficulty", canvas.width / 2, canvas.height / 2 + 84);
    ctx.font = "20px monospace";
    ctx.fillText("Press SPACE to start", canvas.width / 2, canvas.height / 2 + 120);
    ctx.textAlign = "left";
  }

  function draw() {
    ctx.save();
    if (shakeTime > 0) {
      const dx = (Math.random() - 0.5) * shakeMagnitude;
      const dy = (Math.random() - 0.5) * shakeMagnitude;
      ctx.translate(dx, dy);
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
    starfield.draw(ctx);

    if (scene === "start") {
      drawStartScreen();
      ctx.restore();
      return;
    }

    ctx.strokeStyle = "rgba(127, 255, 212, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.center.x, zone.center.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();

    for (const ship of ships) {
      if (ship.alive) drawShip(ship, ship === playerShip && input.thrust);
    }

    ctx.fillStyle = "#fff";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const a of asteroids) drawAsteroid(a);
    for (const p of pickups) drawPickup(p);
    drawParticles();

    const aliveCount = ships.filter((s) => s.alive).length;
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`HP: ${Math.ceil(playerShip.hp)}`, 16, 24);
    ctx.fillText(`Lives: ${playerShip.lives}`, 16, 44);
    ctx.fillText(`Kills: ${playerShip.kills}`, 16, 64);
    ctx.fillText(`Score: ${playerShip.score}`, 16, 84);
    ctx.fillText(`Zone: ${Math.ceil(zone.radius)}`, 16, 104);
    ctx.fillText(`Alive: ${aliveCount}/${ships.length}`, 16, 124);
    if (playerShip.shieldTime > 0) {
      ctx.fillStyle = "#5da8ff";
      ctx.fillText(`Shield: ${playerShip.shieldTime.toFixed(1)}s`, 16, 144);
    }
    if (playerShip.rapidFireTime > 0) {
      ctx.fillStyle = "#ffe45d";
      ctx.fillText(`Rapid Fire: ${playerShip.rapidFireTime.toFixed(1)}s`, 16, playerShip.shieldTime > 0 ? 164 : 144);
    }

    if (scene === "gameover") {
      ctx.textAlign = "center";
      ctx.font = "48px monospace";
      const won = winnerName === "You";
      ctx.fillText(won ? "VICTORY" : "YOU DIED", canvas.width / 2, canvas.height / 2);
      ctx.font = "20px monospace";
      ctx.fillText(`Winner: ${winnerName}`, canvas.width / 2, canvas.height / 2 + 36);
      ctx.fillText(`Kills: ${playerShip.kills}`, canvas.width / 2, canvas.height / 2 + 60);
      if (restartCooldown === 0) {
        ctx.fillText("Press SPACE to restart", canvas.width / 2, canvas.height / 2 + 92);
      }
      ctx.textAlign = "left";
    }

    ctx.restore();
  }

  let lastTime = performance.now();
  let raf = 0;

  function loop(now: number) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    input.dispose();
    sound.closeAudio();
  };
}
