import { Vec2 } from "./vector";

interface Star {
  pos: Vec2;
  size: number;
  brightness: number;
}

export class Starfield {
  private stars: Star[] = [];

  constructor(width: number, height: number, count: number = 120) {
    this.regenerate(width, height, count);
  }

  regenerate(width: number, height: number, count: number = this.stars.length || 120): void {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        pos: { x: Math.random() * width, y: Math.random() * height },
        size: Math.random() < 0.85 ? 1 : 2,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness;
      ctx.fillStyle = "#fff";
      ctx.fillRect(s.pos.x, s.pos.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
}
