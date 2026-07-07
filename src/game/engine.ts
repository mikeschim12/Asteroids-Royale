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
  createShip,
  spawnAsteroid,
  splitAsteroid,
  spawnExplosion,
  SHIP_THRUST,
  SHIP_ROTATION_SPEED,
  SHIP_DRAG,
  BULLET_SPEED,
  BULLET_TTL,
  FIRE_INTERVAL,
  RESPAWN_INVULN_TIME,
} from "./entities";
import { add, scale, fromAngle, distance, wrap } from "./vector";

export type StopGame = () => void;

const BOT_COUNT = 5;
const BOT_COLORS = ["#ff5d5d", "#5da8ff", "#ffe45d", "#c65dff", "#5dffb0"];
const ASTEROID_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };

export function startGame(canvas: HTMLCanvasElement): StopGame {
  const ctx = canvas.getContext("2d")!;
  const starfield = new Starfield(canvas.width, canvas.height);
  const input = new InputState();

  type Scene = "start" | "playing" | "gameover";
  let scene: Scene = "start";

  let nextShipId = 0;
  let playerShip: Ship;
  let ships: Ship[];
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
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
    for (let i = 0; i < BOT_COUNT; i++) {
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
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
    if (intent.fire && ship.fireCooldown === 0) {
      ship.fireCooldown = FIRE_INTERVAL;
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
        intent = computeBotIntent(ship, ships, asteroids, zone);
      } else {
        intent = { rotateLeft: input.rotateLeft, rotateRight: input.rotateRight, thrust: input.thrust, fire: input.fire };
      }
      applyShipControl(ship, intent, dt);

      if (ship.invulnerable === 0 && zone.isOutside(ship.pos)) {
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

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (const ship of ships) {
        if (!ship.alive || ship.id === b.ownerId || ship.invulnerable > 0) continue;
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
        survivingAsteroids.push(...splitAsteroid(a));
      } else {
        survivingAsteroids.push(a);
      }
    }
    asteroids = survivingAsteroids;

    if (asteroids.length === 0) {
      asteroids = spawnWaveAsteroids(8);
    }

    for (const ship of ships) {
      if (!ship.alive || ship.invulnerable > 0) continue;
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

    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i];
        const b = ships[j];
        if (!a.alive || !b.alive || a.invulnerable > 0 || b.invulnerable > 0) continue;
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
    ctx.fillText("ASTEROIDS ROYALE", canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText("WASD / Arrows to move, Space to fire", canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Last one standing wins vs ${BOT_COUNT} bots`, canvas.width / 2, canvas.height / 2 + 36);
    ctx.fillText("Press SPACE to start", canvas.width / 2, canvas.height / 2 + 80);
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
