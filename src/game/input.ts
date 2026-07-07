export class InputState {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) this.justPressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True once for the frame a key transitions from up to down; consumes the event. */
  consumeJustPressed(code: string): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
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
