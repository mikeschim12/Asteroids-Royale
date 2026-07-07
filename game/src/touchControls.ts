/**
 * On-screen touch controls. Dispatches synthetic keyboard events matching
 * the same key codes InputState already listens for, so no changes are
 * needed to input.ts, bot.ts, or the game loop's key-handling logic.
 */

export type Scene = "start" | "playing" | "gameover";

function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
}

interface ButtonSpec {
  label: string;
  code: string;
  style: Partial<CSSStyleDeclaration>;
  tapOnly?: boolean;
}

function createButton(spec: ButtonSpec): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = spec.label;
  Object.assign(el.style, {
    position: "fixed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(127, 255, 212, 0.15)",
    border: "2px solid rgba(127, 255, 212, 0.5)",
    borderRadius: "50%",
    color: "#7fffd4",
    fontFamily: "monospace",
    fontSize: "22px",
    userSelect: "none",
    touchAction: "none",
    zIndex: "1000",
    ...spec.style,
  });

  // A very quick tap can release before the game's per-frame input poll
  // ever observes it as "down". Guarantee every press is held for at
  // least one frame's worth of time so taps always register.
  const MIN_HOLD_MS = 80;
  let pressed = false;
  let pressStart = 0;

  const doRelease = () => {
    pressed = false;
    el.style.background = "rgba(127, 255, 212, 0.15)";
    dispatchKey("keyup", spec.code);
  };

  const press = (e: Event) => {
    e.preventDefault();
    if (pressed) return;
    pressed = true;
    pressStart = performance.now();
    el.style.background = "rgba(127, 255, 212, 0.4)";
    dispatchKey("keydown", spec.code);
    if (spec.tapOnly) {
      setTimeout(doRelease, MIN_HOLD_MS);
    }
  };
  const release = (e: Event) => {
    e.preventDefault();
    if (!pressed || spec.tapOnly) return;
    const elapsed = performance.now() - pressStart;
    if (elapsed < MIN_HOLD_MS) {
      setTimeout(doRelease, MIN_HOLD_MS - elapsed);
    } else {
      doRelease();
    }
  };

  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  return el;
}

export class TouchControls {
  private root: HTMLDivElement;
  private gameplayButtons: HTMLDivElement[] = [];
  private menuButtons: HTMLDivElement[] = [];
  private actionButton: HTMLDivElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.style.position = "fixed";
    this.root.style.inset = "0";
    this.root.style.pointerEvents = "none";
    document.body.appendChild(this.root);

    if (!isTouchDevice()) {
      this.actionButton = document.createElement("div");
      return;
    }

    const mk = (spec: ButtonSpec) => {
      const btn = createButton(spec);
      btn.style.pointerEvents = "auto";
      this.root.appendChild(btn);
      return btn;
    };

    // Gameplay controls: rotate + thrust bottom-left, fire is the shared action button.
    this.gameplayButtons.push(
      mk({ label: "◀", code: "ArrowLeft", style: { left: "20px", bottom: "30px", width: "64px", height: "64px" } }),
      mk({ label: "▶", code: "ArrowRight", style: { left: "96px", bottom: "30px", width: "64px", height: "64px" } }),
      mk({ label: "▲", code: "ArrowUp", style: { left: "58px", bottom: "104px", width: "64px", height: "64px" } })
    );

    // Start-screen menu adjust controls.
    this.menuButtons.push(
      mk({ label: "−", code: "ArrowLeft", tapOnly: true, style: { left: "20px", top: "calc(50% + 40px)", width: "50px", height: "50px" } }),
      mk({ label: "+", code: "ArrowRight", tapOnly: true, style: { left: "80px", top: "calc(50% + 40px)", width: "50px", height: "50px" } }),
      mk({ label: "−", code: "ArrowDown", tapOnly: true, style: { right: "80px", top: "calc(50% + 40px)", width: "50px", height: "50px" } }),
      mk({ label: "+", code: "ArrowUp", tapOnly: true, style: { right: "20px", top: "calc(50% + 40px)", width: "50px", height: "50px" } })
    );

    this.actionButton = mk({
      label: "FIRE",
      code: "Space",
      style: { right: "24px", bottom: "40px", width: "90px", height: "90px", fontSize: "16px" },
    });
  }

  sync(scene: Scene) {
    for (const b of this.gameplayButtons) b.style.display = scene === "playing" ? "flex" : "none";
    for (const b of this.menuButtons) b.style.display = scene === "start" ? "flex" : "none";
    this.actionButton.textContent = scene === "start" ? "START" : scene === "gameover" ? "RESTART" : "FIRE";
  }
}
