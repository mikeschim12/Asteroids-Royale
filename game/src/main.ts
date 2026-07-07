import { InputState } from "./input";
import { ShrinkingZone } from "./zone";
import { Starfield } from "./starfield";
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

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const starfield = new Starfield(window.innerWidth, window.innerHeight);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  starfield.regenerate(canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

const input = new InputState();

type Scene = "start" | "playing" | "gameover";
let scene: Scene = "start";

let ship: Ship;
let bullets: Bullet[];
let asteroids: Asteroid[];
let particles: Particle[];
let zone: ShrinkingZone;
let score = 0;
let restartCooldown = 0;
let shakeTime = 0;
let shakeMagnitude = 0;
let thrustSoundCooldown = 0;

const ASTEROID_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };

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

function resetGame() {
  ship = createShip({ x: canvas.width / 2, y: canvas.height / 2 });
  bullets = [];
  asteroids = spawnWaveAsteroids(6);
  particles = [];
  score = 0;
  scene = "playing";
  zone = new ShrinkingZone(
    { x: canvas.width / 2, y: canvas.height / 2 },
    Math.max(canvas.width, canvas.height) * 0.6,
    120,
    1.5
  );
}

let lastTime = performance.now();

function killShip() {
  particles.push(...spawnExplosion(ship.pos, "#7fffd4", 24));
  sound.playExplosion(3);
  shake(10, 0.4);
  ship.lives -= 1;
  if (ship.lives <= 0) {
    ship.alive = false;
    scene = "gameover";
    restartCooldown = 1;
  } else {
    ship.pos = { x: canvas.width / 2, y: canvas.height / 2 };
    ship.vel = { x: 0, y: 0 };
    ship.hp = ship.maxHp;
    ship.invulnerable = RESPAWN_INVULN_TIME;
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
    thrustSoundCooldown = Math.max(0, thrustSoundCooldown - dt);
    if (thrustSoundCooldown === 0) {
      sound.playThrust();
      thrustSoundCooldown = 0.1;
    }
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
    sound.playFire();
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
      sound.playExplosion(a.size);
      shake(a.size * 1.5, 0.15);
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
        sound.playHit();
        shake(6, 0.2);
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
  if (input.thrust) {
    ctx.strokeStyle = "#ff9d4d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.radius * 0.4, 0);
    ctx.lineTo(-s.radius * (1.1 + Math.random() * 0.4), 0);
    ctx.stroke();
  }
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

function drawStartScreen() {
  ctx.textAlign = "center";
  ctx.fillStyle = "#7fffd4";
  ctx.font = "56px monospace";
  ctx.fillText("ASTEROIDS ROYALE", canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.fillText("WASD / Arrows to move, Space to fire", canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText("Survive the shrinking zone and the asteroid field", canvas.width / 2, canvas.height / 2 + 36);
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

  if (scene === "gameover") {
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
