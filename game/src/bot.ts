import { Ship, Asteroid, Bullet, BULLET_SPEED } from "./entities";
import { ShrinkingZone } from "./zone";
import { Vec2, distance, add, scale } from "./vector";

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Deterministic per-bot personality derived from id, so behavior is
// stable across frames without storing extra state on the bot.
function personality(id: number) {
  const seed = Math.sin(id * 12.9898) * 43758.5453;
  const frac = seed - Math.floor(seed);
  return {
    aimSkill: 0.5 + frac * 0.5, // 0.5-1.0, higher = better lead prediction & accuracy
    aggression: 0.4 + ((frac * 7) % 1) * 0.6, // 0.4-1.0, higher = engages from farther / more often
    reaction: 0.5 + ((frac * 13) % 1) * 0.5, // 0.5-1.0, higher = better bullet dodging
  };
}

export interface BotIntent {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  fire: boolean;
}

function leadPosition(bot: Ship, target: Ship): Vec2 {
  const d = distance(bot.pos, target.pos);
  const timeToHit = d / BULLET_SPEED;
  return add(target.pos, scale(target.vel, timeToHit));
}

function nearestIncomingBullet(bot: Ship, bullets: Bullet[]): Bullet | null {
  let nearest: Bullet | null = null;
  let bestDist = Infinity;
  for (const b of bullets) {
    if (b.ownerId === bot.id) continue;
    const d = distance(bot.pos, b.pos);
    if (d > 140) continue;
    const toBot = { x: bot.pos.x - b.pos.x, y: bot.pos.y - b.pos.y };
    const bulletDir = b.vel.x === 0 && b.vel.y === 0 ? { x: 0, y: 0 } : scale(b.vel, 1 / Math.hypot(b.vel.x, b.vel.y));
    const toBotLen = Math.hypot(toBot.x, toBot.y) || 1;
    const dot = (toBot.x * bulletDir.x + toBot.y * bulletDir.y) / toBotLen;
    if (dot > 0.85 && d < bestDist) {
      bestDist = d;
      nearest = b;
    }
  }
  return nearest;
}

function nearestAsteroidInPath(bot: Ship, asteroids: Asteroid[]): Asteroid | null {
  let nearest: Asteroid | null = null;
  let bestDist = Infinity;
  const heading = { x: Math.cos(bot.angle), y: Math.sin(bot.angle) };
  for (const a of asteroids) {
    const d = distance(bot.pos, a.pos);
    if (d > 120) continue;
    const toA = { x: a.pos.x - bot.pos.x, y: a.pos.y - bot.pos.y };
    const len = Math.hypot(toA.x, toA.y) || 1;
    const dot = (toA.x * heading.x + toA.y * heading.y) / len;
    if (dot > 0.7 && d < bestDist) {
      bestDist = d;
      nearest = a;
    }
  }
  return nearest;
}

export function computeBotIntent(
  bot: Ship,
  ships: Ship[],
  asteroids: Asteroid[],
  bullets: Bullet[],
  zone: ShrinkingZone
): BotIntent {
  const intent: BotIntent = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };
  if (!bot.alive) return intent;

  const traits = personality(bot.id);

  if (zone.isOutside(bot.pos)) {
    const desired = angleTo(bot.pos, zone.center);
    const diff = normalizeAngle(desired - bot.angle);
    if (diff > 0.05) intent.rotateRight = true;
    else if (diff < -0.05) intent.rotateLeft = true;
    intent.thrust = true;
    return intent;
  }

  // Dodge an incoming bullet before anything else, if reaction allows.
  const threat = nearestIncomingBullet(bot, bullets);
  if (threat && Math.random() < traits.reaction) {
    const away = angleTo(threat.pos, bot.pos);
    const diff = normalizeAngle(away - bot.angle);
    if (diff > 0.1) intent.rotateRight = true;
    else if (diff < -0.1) intent.rotateLeft = true;
    intent.thrust = true;
    return intent;
  }

  let targetShip: Ship | null = null;
  let bestShipDist = Infinity;
  for (const other of ships) {
    if (other.id === bot.id || !other.alive) continue;
    const d = distance(bot.pos, other.pos);
    if (d < bestShipDist) {
      bestShipDist = d;
      targetShip = other;
    }
  }

  const engageRange = 300 + traits.aggression * 300;
  const inCombat = targetShip !== null && bestShipDist < engageRange;

  // Steer around an asteroid dead ahead, unless we're mid-dogfight and
  // aggression says push through.
  const blockingAsteroid = nearestAsteroidInPath(bot, asteroids);
  if (blockingAsteroid && !(inCombat && traits.aggression > 0.8)) {
    const side = angleTo(bot.pos, blockingAsteroid.pos) - bot.angle > 0 ? -1 : 1;
    if (side < 0) intent.rotateLeft = true;
    else intent.rotateRight = true;
    intent.thrust = true;
    return intent;
  }

  let target: Vec2 | null = null;
  let targetIsShip = false;
  let bestDist = Infinity;

  if (inCombat && targetShip) {
    target = leadPosition(bot, targetShip);
    targetIsShip = true;
    bestDist = bestShipDist;
  } else {
    for (const a of asteroids) {
      const d = distance(bot.pos, a.pos);
      if (d < bestDist) {
        bestDist = d;
        target = a.pos;
        targetIsShip = false;
      }
    }
  }

  if (!target) {
    intent.thrust = Math.random() < 0.02 ? !intent.thrust : intent.thrust;
    return intent;
  }

  const desired = angleTo(bot.pos, target);
  const diff = normalizeAngle(desired - bot.angle);
  const aimTolerance = 0.16 - traits.aimSkill * 0.1;

  if (Math.abs(diff) > aimTolerance) {
    if (diff > 0) intent.rotateRight = true;
    else intent.rotateLeft = true;
  } else if (targetIsShip) {
    intent.fire = true;
  }

  if (bestDist > 150) intent.thrust = true;
  else if (bestDist < 80 && targetIsShip) intent.thrust = Math.random() < 0.3;

  if (!targetIsShip && Math.abs(diff) < 0.15) intent.fire = bestDist < 350;

  return intent;
}
