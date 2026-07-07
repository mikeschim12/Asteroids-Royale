import { Vec2, add, scale, fromAngle } from "./vector";

export interface Ship {
  id: number;
  isBot: boolean;
  name: string;
  color: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  alive: boolean;
  lives: number;
  invulnerable: number;
  kills: number;
  score: number;
}

export interface Bullet {
  ownerId: number;
  pos: Vec2;
  vel: Vec2;
  ttl: number;
}

export interface Asteroid {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  size: 1 | 2 | 3;
  shape: number[];
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  ttl: number;
  maxTtl: number;
  color: string;
  radius: number;
}

export const SHIP_THRUST = 220;
export const SHIP_ROTATION_SPEED = 3.2;
export const SHIP_DRAG = 0.985;
export const SHIP_RADIUS = 14;
export const SHIP_MAX_HP = 100;
export const BULLET_SPEED = 480;
export const BULLET_TTL = 1.1;
export const FIRE_INTERVAL = 0.22;
export const SHIP_STARTING_LIVES = 3;
export const RESPAWN_INVULN_TIME = 2.5;
export const ASTEROID_SHAPE_POINTS = 10;

export function createShip(
  id: number,
  pos: Vec2,
  options: { isBot?: boolean; name?: string; color?: string; lives?: number } = {}
): Ship {
  return {
    id,
    isBot: options.isBot ?? false,
    name: options.name ?? (options.isBot ? `Bot ${id}` : "You"),
    color: options.color ?? "#7fffd4",
    pos,
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2,
    radius: SHIP_RADIUS,
    hp: SHIP_MAX_HP,
    maxHp: SHIP_MAX_HP,
    fireCooldown: 0,
    alive: true,
    lives: options.lives ?? SHIP_STARTING_LIVES,
    invulnerable: RESPAWN_INVULN_TIME,
    kills: 0,
    score: 0,
  };
}

function randomAsteroidShape(): number[] {
  const points: number[] = [];
  for (let i = 0; i < ASTEROID_SHAPE_POINTS; i++) {
    points.push(0.7 + Math.random() * 0.45);
  }
  return points;
}

export function spawnAsteroid(pos: Vec2, size: 1 | 2 | 3): Asteroid {
  const radius = size === 3 ? 48 : size === 2 ? 28 : 16;
  const speed = 20 + Math.random() * 60;
  const angle = Math.random() * Math.PI * 2;
  return {
    pos,
    vel: scale(fromAngle(angle), speed),
    radius,
    rotation: 0,
    rotationSpeed: (Math.random() - 0.5) * 2,
    size,
    shape: randomAsteroidShape(),
  };
}

export function splitAsteroid(a: Asteroid): Asteroid[] {
  if (a.size === 1) return [];
  const nextSize = (a.size - 1) as 1 | 2;
  return [spawnAsteroid(add(a.pos, { x: 5, y: 5 }), nextSize), spawnAsteroid(add(a.pos, { x: -5, y: -5 }), nextSize)];
}

export function spawnExplosion(pos: Vec2, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 160;
    const ttl = 0.35 + Math.random() * 0.4;
    particles.push({
      pos: { ...pos },
      vel: scale(fromAngle(angle), speed),
      ttl,
      maxTtl: ttl,
      color,
      radius: 1 + Math.random() * 2,
    });
  }
  return particles;
}
