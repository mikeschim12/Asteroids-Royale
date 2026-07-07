export interface Vec2 {
  x: number;
  y: number;
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function fromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wrap(v: Vec2, width: number, height: number): Vec2 {
  return {
    x: ((v.x % width) + width) % width,
    y: ((v.y % height) + height) % height,
  };
}
