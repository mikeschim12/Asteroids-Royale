import { InputState } from "./input";
import { ShrinkingZone } from "./zone";
import {
  Ship,
  Bullet,
  Asteroid,
  createShip,
  spawnAsteroid,
  splitAsteroid,
  SHIP_THRUST,
  SHIP_ROTATION_SPEED,
  SHIP_DRAG,
  BULLET_SPEED,
  BULLET_TTL,
  FIRE_INTERVAL,
} from "./entities";
import { add, scale, fromAngle, distance, wrap } from "./vector";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const input = new InputState();
const ship = createShip({ x: canvas.width / 2, y: canvas.height / 2 });
const bullets: Bullet[] = [];
let asteroids: Asteroid[] = [];
for (let i = 0; i < 6; i++) {
  const edge = Math.random() < 0.5 ? 0 : canvas.width;
  asteroids.push(spawnAsteroid({ x: edge, y: Math.random() * canvas.height }, 3));
}

const zone = new ShrinkingZone(
  { x: canvas.width / 2, y: canvas.height / 2 },
  Math.max(canvas.width, canvas.height) * 0.6,
  120,
  1.5
);

let lastTime = performance.now();

function update(dt: number) {
  if (ship.alive) {
    if (input.rotateLeft) ship.angle -= SHIP_ROTATION_SPEED * dt;
    if (input.rotateRight) ship.angle += SHIP_ROTATION_SPEED * dt;
    if (input.thrust) {
      const thrustVec = scale(fromAngle(ship.angle), SHIP_THRUST * dt);
      ship.vel = add(ship.vel, thrustVec);
    }
    ship.vel = scale(ship.vel, SHIP_DRAG);
    ship.pos = wrap(add(ship.pos, scale(ship.vel, dt)), canvas.width, canvas.height);

    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
    if (input.fire && ship.fireCooldown === 0) {
      ship.fireCooldown = FIRE_INTERVAL;
      bullets.push({
        pos: add(ship.pos, scale(fromAngle(ship.angle), ship.radius)),
        vel: add(ship.vel, scale(fromAngle(ship.angle), BULLET_SPEED)),
        ttl: BULLET_TTL,
      });
    }

    if (zone.isOutside(ship.pos)) {
      ship.hp -= zone.damagePerSecond * dt;
      if (ship.hp <= 0) {
        ship.hp = 0;
        ship.alive = false;
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
      survivingAsteroids.push(...splitAsteroid(a));
    } else {
      survivingAsteroids.push(a);
    }
  }
  asteroids = survivingAsteroids;

  if (ship.alive) {
    for (const a of asteroids) {
      if (distance(ship.pos, a.pos) < a.radius + ship.radius) {
        ship.hp -= 34;
        if (ship.hp <= 0) {
          ship.hp = 0;
          ship.alive = false;
        }
      }
    }
  }
}

function drawShip(s: Ship) {
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.rotate(s.angle);
  ctx.strokeStyle = s.alive ? "#7fffd4" : "#555";
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

function draw() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(127, 255, 212, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(zone.center.x, zone.center.y, zone.radius, 0, Math.PI * 2);
  ctx.stroke();

  drawShip(ship);

  ctx.fillStyle = "#fff";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#ccc";
  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, a.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "16px monospace";
  ctx.fillText(`HP: ${Math.ceil(ship.hp)}`, 16, 24);
  ctx.fillText(`Zone: ${Math.ceil(zone.radius)}`, 16, 44);
  if (!ship.alive) {
    ctx.font = "48px monospace";
    ctx.fillText("YOU DIED", canvas.width / 2 - 140, canvas.height / 2);
  }
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
