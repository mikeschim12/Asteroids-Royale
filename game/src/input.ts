export class InputState {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get thrust(): boolean {
    return this.isDown("ArrowUp") || this.isDown("KeyW");
  }

  get rotateLeft(): boolean {
    return this.isDown("ArrowLeft") || this.isDown("KeyA");
  }

  get rotateRight(): boolean {
    return this.isDown("ArrowRight") || this.isDown("KeyD");
  }

  get fire(): boolean {
    return this.isDown("Space");
  }
}
