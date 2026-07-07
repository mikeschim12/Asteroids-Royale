import { ShrinkingZone } from "./zone";
import { Vec2, add, scale, fromAngle, distance, wrap } from "./vector";
import {
  Ship,
  Bullet,
  Asteroid,
  Pickup,
  PickupType,
  spawnAsteroid,
  splitAsteroid,
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

export type Scene = "start" | "playing" | "gameover" | "waiting";

export interface ShipIntent {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  fire: boolean;
}

export interface GameState {
  width: number;
  height: number;
  scene: Scene;
  ships: Ship[];
  bullets: Bullet[];
  asteroids: Asteroid[];
  pickups: Pickup[];
  zone: ShrinkingZone;
  winnerName: string | null;
  restartCooldown: number;
}

export type SimEvent =
  | { type: "shipExplosion"; pos: Vec2; color: string; shipId: number }
  | { type: "asteroidExplosion"; pos: Vec2; size: 1 | 2 | 3 }
  | { type: "hit"; pos: Vec2; shipId: number }
  | { type: "pickup"; pos: Vec2; pickupType: PickupType; shipId: number };

export const ASTEROID_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 50, 3: 20 };
const SHIP_DAMAGE = 34;
const SHIP_COLLISION_DAMAGE = 20;

export function spawnWaveAsteroids(width: number, height: number, count: number): Asteroid[] {
  const result: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const edge = Math.random() < 0.5 ? 0 : width;
    result.push(spawnAsteroid({ x: edge, y: Math.random() * height }, 3));
  }
  return result;
}

export function randomSpawnPos(width: number, height: number): Vec2 {
  const margin = 100;
  return {
    x: margin + Math.random() * Math.max(1, width - margin * 2),
    y: margin + Math.random() * Math.max(1, height - margin * 2),
  };
}

export function createInitialGameState(width: number, height: number, ships: Ship[]): GameState {
  return {
    width,
    height,
    scene: "playing",
    ships,
    bullets: [],
    asteroids: spawnWaveAsteroids(width, height, 8),
    pickups: [],
    zone: new ShrinkingZone({ x: width / 2, y: height / 2 }, Math.max(width, height) * 0.6, 140, 1.2),
    winnerName: null,
    restartCooldown: 0,
  };
}

function isProtected(ship: Ship): boolean {
  return ship.invulnerable > 0 || ship.shieldTime > 0;
}

function applyPickup(ship: Ship, type: PickupType) {
  if (type === "shield") {
    ship.shieldTime = Math.max(ship.shieldTime, SHIELD_DURATION);
  } else if (type === "rapid") {
    ship.rapidFireTime = Math.max(ship.rapidFireTime, RAPID_FIRE_DURATION);
  } else {
    ship.hp = Math.min(ship.maxHp, ship.hp + REPAIR_AMOUNT);
  }
}

/**
 * Checks whether the match has been decided (0 or 1 ships left alive) and,
 * if so, transitions the state to "gameover". Called after any kill, and
 * also needs to be called by hosts (e.g. a multiplayer server) after a
 * ship is removed outright, like on player disconnect.
 */
export function checkWinCondition(state: GameState): void {
  if (state.scene !== "playing") return;
  const aliveShips = state.ships.filter((s) => s.alive);
  if (aliveShips.length <= 1) {
    state.scene = "gameover";
    state.restartCooldown = 1;
    state.winnerName = aliveShips.length === 1 ? aliveShips[0].name : "No one";
  }
}

function killShip(state: GameState, ship: Ship, killerId: number | null, events: SimEvent[]) {
  events.push({ type: "shipExplosion", pos: { ...ship.pos }, color: ship.color, shipId: ship.id });
  ship.lives -= 1;

  if (killerId !== null) {
    const killer = state.ships.find((s) => s.id === killerId);
    if (killer && killer.id !== ship.id) killer.kills += 1;
  }

  if (ship.lives <= 0) {
    ship.alive = false;
  } else {
    ship.pos = randomSpawnPos(state.width, state.height);
    ship.vel = { x: 0, y: 0 };
    ship.hp = ship.maxHp;
    ship.invulnerable = RESPAWN_INVULN_TIME;
  }

  checkWinCondition(state);
}

function applyShipControl(state: GameState, ship: Ship, intent: ShipIntent, dt: number) {
  ship.thrusting = false;
  if (intent.rotateLeft) ship.angle -= SHIP_ROTATION_SPEED * dt;
  if (intent.rotateRight) ship.angle += SHIP_ROTATION_SPEED * dt;
  if (intent.thrust) {
    ship.thrusting = true;
    const thrustVec = scale(fromAngle(ship.angle), SHIP_THRUST * dt);
    ship.vel = add(ship.vel, thrustVec);
  }
  ship.vel = scale(ship.vel, SHIP_DRAG);
  ship.pos = wrap(add(ship.pos, scale(ship.vel, dt)), state.width, state.height);

  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
  ship.shieldTime = Math.max(0, ship.shieldTime - dt);
  ship.rapidFireTime = Math.max(0, ship.rapidFireTime - dt);
  ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
  if (intent.fire && ship.fireCooldown === 0) {
    ship.fireCooldown = ship.rapidFireTime > 0 ? FIRE_INTERVAL * RAPID_FIRE_MULTIPLIER : FIRE_INTERVAL;
    state.bullets.push({
      ownerId: ship.id,
      pos: add(ship.pos, scale(fromAngle(ship.angle), ship.radius)),
      vel: add(ship.vel, scale(fromAngle(ship.angle), BULLET_SPEED)),
      ttl: BULLET_TTL,
    });
  }
}

/**
 * Advances the game world by one tick. Pure with respect to the outside
 * world -- all side effects (sound, particles, screen shake) are the
 * caller's responsibility, driven by the returned events. Shared by the
 * local single-device loop and the authoritative multiplayer server so
 * gameplay logic never has to be maintained in two places.
 */
export function stepSimulation(state: GameState, intents: Map<number, ShipIntent>, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.scene !== "playing") return events;

  for (const ship of state.ships) {
    if (!ship.alive) continue;
    const intent = intents.get(ship.id) ?? { rotateLeft: false, rotateRight: false, thrust: false, fire: false };
    applyShipControl(state, ship, intent, dt);

    if (!isProtected(ship) && state.zone.isOutside(ship.pos)) {
      ship.hp -= state.zone.damagePerSecond * dt;
      if (ship.hp <= 0) {
        ship.hp = 0;
        killShip(state, ship, null, events);
      }
    }
  }

  state.zone.update(dt);

  for (const b of state.bullets) {
    b.pos = wrap(add(b.pos, scale(b.vel, dt)), state.width, state.height);
    b.ttl -= dt;
  }
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    if (state.bullets[i].ttl <= 0) state.bullets.splice(i, 1);
  }

  for (const a of state.asteroids) {
    a.pos = wrap(add(a.pos, scale(a.vel, dt)), state.width, state.height);
    a.rotation += a.rotationSpeed * dt;
  }

  // Bullets vs ships
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    for (const ship of state.ships) {
      if (!ship.alive || ship.id === b.ownerId || isProtected(ship)) continue;
      if (distance(b.pos, ship.pos) < ship.radius) {
        state.bullets.splice(i, 1);
        ship.hp -= SHIP_DAMAGE;
        events.push({ type: "hit", pos: { ...ship.pos }, shipId: ship.id });
        if (ship.hp <= 0) {
          ship.hp = 0;
          killShip(state, ship, b.ownerId, events);
        }
        break;
      }
    }
  }

  // Bullets vs asteroids
  const survivingAsteroids: Asteroid[] = [];
  for (const a of state.asteroids) {
    let shooterId: number | null = null;
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      if (distance(state.bullets[i].pos, a.pos) < a.radius) {
        shooterId = state.bullets[i].ownerId;
        state.bullets.splice(i, 1);
        break;
      }
    }
    if (shooterId !== null) {
      const shooter = state.ships.find((s) => s.id === shooterId);
      if (shooter) shooter.score += ASTEROID_SCORE[a.size];
      events.push({ type: "asteroidExplosion", pos: { ...a.pos }, size: a.size });
      if (Math.random() < PICKUP_DROP_CHANCE) {
        state.pickups.push(spawnPickup(a.pos));
      }
      survivingAsteroids.push(...splitAsteroid(a));
    } else {
      survivingAsteroids.push(a);
    }
  }
  state.asteroids = survivingAsteroids;

  if (state.asteroids.length === 0) {
    state.asteroids = spawnWaveAsteroids(state.width, state.height, 8);
  }

  for (const p of state.pickups) {
    p.ttl -= dt;
  }
  state.pickups = state.pickups.filter((p) => p.ttl > 0);

  // Ships vs pickups
  for (const ship of state.ships) {
    if (!ship.alive) continue;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      if (distance(ship.pos, state.pickups[i].pos) < ship.radius + PICKUP_RADIUS) {
        applyPickup(ship, state.pickups[i].type);
        events.push({ type: "pickup", pos: { ...ship.pos }, pickupType: state.pickups[i].type, shipId: ship.id });
        state.pickups.splice(i, 1);
      }
    }
  }

  // Ships vs asteroids
  for (const ship of state.ships) {
    if (!ship.alive || isProtected(ship)) continue;
    for (const a of state.asteroids) {
      if (distance(ship.pos, a.pos) < a.radius + ship.radius) {
        ship.hp -= SHIP_DAMAGE;
        events.push({ type: "hit", pos: { ...ship.pos }, shipId: ship.id });
        if (ship.hp <= 0) {
          ship.hp = 0;
          killShip(state, ship, null, events);
        }
        break;
      }
    }
  }

  // Ship vs ship collision
  for (let i = 0; i < state.ships.length; i++) {
    for (let j = i + 1; j < state.ships.length; j++) {
      const a = state.ships[i];
      const b = state.ships[j];
      if (!a.alive || !b.alive || isProtected(a) || isProtected(b)) continue;
      if (distance(a.pos, b.pos) < a.radius + b.radius) {
        a.hp -= SHIP_COLLISION_DAMAGE;
        b.hp -= SHIP_COLLISION_DAMAGE;
        events.push({ type: "hit", pos: { ...a.pos }, shipId: a.id });
        events.push({ type: "hit", pos: { ...b.pos }, shipId: b.id });
        if (a.hp <= 0) {
          a.hp = 0;
          killShip(state, a, b.id, events);
        }
        if (b.hp <= 0) {
          b.hp = 0;
          killShip(state, b, a.id, events);
        }
      }
    }
  }

  return events;
}
