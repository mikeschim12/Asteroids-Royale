import { Ship, Asteroid } from "./entities";
import { ShrinkingZone } from "./zone";
import { Vec2, distance } from "./vector";

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface BotIntent {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  fire: boolean;
}

export function computeBotIntent(bot: Ship, ships: Ship[], asteroids: Asteroid[], zone: ShrinkingZone): BotIntent {
  const intent: BotIntent = { rotateLeft: false, rotateRight: false, thrust: false, fire: false };
  if (!bot.alive) return intent;

  if (zone.isOutside(bot.pos)) {
    const desired = angleTo(bot.pos, zone.center);
    const diff = normalizeAngle(desired - bot.angle);
    if (diff > 0.05) intent.rotateRight = true;
    else if (diff < -0.05) intent.rotateLeft = true;
    intent.thrust = true;
    return intent;
  }

  let target: Vec2 | null = null;
  let targetIsShip = false;
  let bestDist = Infinity;

  for (const other of ships) {
    if (other.id === bot.id || !other.alive) continue;
    const d = distance(bot.pos, other.pos);
    if (d < bestDist) {
      bestDist = d;
      target = other.pos;
      targetIsShip = true;
    }
  }

  if (!target || bestDist > 500) {
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

  if (Math.abs(diff) > 0.08) {
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
