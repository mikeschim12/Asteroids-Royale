import { Vec2, distance } from "./vector";

export class ShrinkingZone {
  center: Vec2;
  radius: number;
  readonly minRadius: number;
  private readonly shrinkPerSecond: number;
  readonly damagePerSecond = 12;

  constructor(center: Vec2, startRadius: number, minRadius: number, shrinkPerSecond: number) {
    this.center = center;
    this.radius = startRadius;
    this.minRadius = minRadius;
    this.shrinkPerSecond = shrinkPerSecond;
  }

  update(dt: number): void {
    if (this.radius > this.minRadius) {
      this.radius = Math.max(this.minRadius, this.radius - this.shrinkPerSecond * dt);
    }
  }

  isOutside(pos: Vec2): boolean {
    return distance(pos, this.center) > this.radius;
  }
}
