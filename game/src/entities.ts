import { Vec2, add, scale, fromAngle } from "./vector";

export interface Ship {
  pos: Vec2;
  vel: Vec2;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  alive: boolean;
}

export interface Bullet {
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
}

export const SHIP_THRUST = 220;
export const SHIP_ROTATION_SPEED = 3.2;
export const SHIP_DRAG = 0.985;
export const SHIP_RADIUS = 14;
export const SHIP_MAX_HP = 100;
export const BULLET_SPEED = 480;
export const BULLET_TTL = 1.1;
export const FIRE_INTERVAL = 0.22;

export function createShip(pos: Vec2): Ship {
  return {
    pos,
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2,
    radius: SHIP_RADIUS,
    hp: SHIP_MAX_HP,
    maxHp: SHIP_MAX_HP,
    fireCooldown: 0,
    alive: true,
  };
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
  };
}

export function splitAsteroid(a: Asteroid): Asteroid[] {
  if (a.size === 1) return [];
  const nextSize = (a.size - 1) as 1 | 2;
  return [spawnAsteroid(add(a.pos, { x: 5, y: 5 }), nextSize), spawnAsteroid(add(a.pos, { x: -5, y: -5 }), nextSize)];
}
