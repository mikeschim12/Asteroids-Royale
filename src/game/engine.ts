import { InputState } from "./input";
import { ShrinkingZone } from "./zone";
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

const ASTEROID_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };

export function startGame(canvas: HTMLCanvasElement): StopGame {
  const ctx = canvas.getContext("2d")!;
  const input = new InputState();

  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let zone: ShrinkingZone;
  let score = 0;
  let gameOver = false;
  let restartCooldown = 0;

  function spawnWaveAsteroids(count: number) {
    const result: Asteroid[] = [];
    for (let i = 0; i < count; i++) {
      const edge = Math.random() < 0.5 ? 0 : canvas.width;
      result.push(spawnAsteroid({ x: edge, y: Math.random() * canvas.height }, 3));
    }
    return result;
  }

  function resetGame() {
    ship = createShip({ x: canvas.width / 2, y: canvas.height / 2 });
    bullets = [];
    asteroids = spawnWaveAsteroids(6);
    particles = [];
    score = 0;
    gameOver = false;
    zone = new ShrinkingZone(
      { x: canvas.width / 2, y: canvas.height / 2 },
      Math.max(canvas.width, canvas.height) * 0.6,
      120,
      1.5
    );
  }

  resetGame();

  function killShip() {
    particles.push(...spawnExplosion(ship.pos, "#7fffd4", 24));
    ship.lives -= 1;
    if (ship.lives <= 0) {
      ship.alive = false;
      gameOver = true;
      restartCooldown = 1;
    } else {
      ship.pos = { x: canvas.width / 2, y: canvas.height / 2 };
      ship.vel = { x: 0, y: 0 };
      ship.hp = ship.maxHp;
      ship.invulnerable = RESPAWN_INVULN_TIME;
    }
  }

  function update(dt: number) {
    if (gameOver) {
      restartCooldown = Math.max(0, restartCooldown - dt);
      if (restartCooldown === 0 && input.fire) {
        resetGame();
      }
      return;
    }

    if (input.rotateLeft) ship.angle -= SHIP_ROTATION_SPEED * dt;
    if (input.rotateRight) ship.angle += SHIP_ROTATION_SPEED * dt;
    if (input.thrust) {
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
    }
    ship.vel = scale(ship.vel, SHIP_DRAG);
    ship.pos = wrap(add(ship.pos, scale(ship.vel, dt)), canvas.width, canvas.height);

    ship.invulnerable = Math.max(0, ship.invulnerable - dt);
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
    if (input.fire && ship.fireCooldown === 0) {
      ship.fireCooldown = FIRE_INTERVAL;
      bullets.push({
        pos: add(ship.pos, scale(fromAngle(ship.angle), ship.radius)),
        vel: add(ship.vel, scale(fromAngle(ship.angle), BULLET_SPEED)),
        ttl: BULLET_TTL,
      });
    }

    if (ship.invulnerable === 0 && zone.isOutside(ship.pos)) {
      ship.hp -= zone.damagePerSecond * dt;
      if (ship.hp <= 0) {
        ship.hp = 0;
        killShip();
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

    const survivingAsteroids: Asteroid[] = [];
    for (const a of asteroids) {
      let hit = false;
      for (let i = bullets.length - 1; i >= 0; i--) {
        if (distance(bullets[i].pos, a.pos) < a.radius) {
          bullets.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        score += ASTEROID_SCORE[a.size];
        particles.push(...spawnExplosion(a.pos, "#ccc", 12));
        survivingAsteroids.push(...splitAsteroid(a));
      } else {
        survivingAsteroids.push(a);
      }
    }
    asteroids = survivingAsteroids;

    if (asteroids.length === 0) {
      asteroids = spawnWaveAsteroids(6);
    }

    if (ship.invulnerable === 0) {
      for (const a of asteroids) {
        if (distance(ship.pos, a.pos) < a.radius + ship.radius) {
          ship.hp -= 34;
          if (ship.hp <= 0) {
            ship.hp = 0;
            killShip();
          }
          break;
        }
      }
    }
  }

  function drawShip(s: Ship) {
    if (s.invulnerable > 0 && Math.floor(s.invulnerable * 10) % 2 === 0) return;
    ctx.save();
    ctx.translate(s.pos.x, s.pos.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = "#7fffd4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.radius, 0);
    ctx.lineTo(-s.radius * 0.8, s.radius * 0.7);
    ctx.lineTo(-s.radius * 0.4, 0);
    ctx.lineTo(-s.radius * 0.8, -s.radius * 0.7);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
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

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(127, 255, 212, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.center.x, zone.center.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (ship.alive) drawShip(ship);

    ctx.fillStyle = "#fff";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const a of asteroids) drawAsteroid(a);
    drawParticles();

    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`HP: ${Math.ceil(ship.hp)}`, 16, 24);
    ctx.fillText(`Lives: ${ship.lives}`, 16, 44);
    ctx.fillText(`Score: ${score}`, 16, 64);
    ctx.fillText(`Zone: ${Math.ceil(zone.radius)}`, 16, 84);

    if (gameOver) {
      ctx.textAlign = "center";
      ctx.font = "48px monospace";
      ctx.fillText("YOU DIED", canvas.width / 2, canvas.height / 2);
      ctx.font = "20px monospace";
      ctx.fillText(`Final score: ${score}`, canvas.width / 2, canvas.height / 2 + 36);
      if (restartCooldown === 0) {
        ctx.fillText("Press SPACE to restart", canvas.width / 2, canvas.height / 2 + 64);
      }
      ctx.textAlign = "left";
    }
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
  };
}
