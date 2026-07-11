const STORAGE_KEY = "asteroids-royale:username";
const MAX_LENGTH = 16;

export function loadUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").slice(0, MAX_LENGTH);
  } catch {
    return "";
  }
}

function saveUsername(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Private browsing / storage disabled -- the name just won't persist.
  }
}

/**
 * Always-visible corner widget for viewing/editing the player's display
 * name. There's no separate settings screen in this canvas-only UI, so
 * this doubles as both "enter a name before joining PvP" and "edit your
 * name later" -- it's reachable and editable in every mode.
 */
export class NameEntry {
  private root: HTMLDivElement;
  private label: HTMLButtonElement;
  private input: HTMLInputElement;
  private username: string;

  constructor(container: HTMLElement, onChange: (name: string) => void) {
    this.username = loadUsername();

    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      top: "12px",
      left: "12px",
      zIndex: "2147483647",
    });
    container.appendChild(this.root);

    this.label = document.createElement("button");
    this.label.type = "button";
    Object.assign(this.label.style, {
      background: "rgba(0, 0, 0, 0.5)",
      border: "1px solid rgba(127, 255, 212, 0.5)",
      borderRadius: "6px",
      color: "#7fffd4",
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "monospace",
      fontSize: "13px",
    });
    this.root.appendChild(this.label);

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.maxLength = MAX_LENGTH;
    this.input.placeholder = "Your name";
    Object.assign(this.input.style, {
      display: "none",
      background: "rgba(0, 0, 0, 0.85)",
      border: "1px solid #7fffd4",
      borderRadius: "6px",
      color: "#fff",
      padding: "4px 8px",
      fontFamily: "monospace",
      fontSize: "13px",
      width: "140px",
    });
    this.root.appendChild(this.input);

    const commit = () => {
      const next = this.input.value.trim().slice(0, MAX_LENGTH);
      this.username = next;
      saveUsername(next);
      onChange(next);
      this.stopEditing();
    };

    this.label.addEventListener("click", () => this.startEditing());
    // The game's own key handling listens on `window`; stop these events
    // from bubbling there so typing a name doesn't also fire in-game
    // actions (Space to fire, M to switch mode, WASD to move, etc).
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") commit();
      else if (e.key === "Escape") this.stopEditing();
    });
    this.input.addEventListener("keyup", (e) => e.stopPropagation());
    this.input.addEventListener("blur", commit);

    this.updateLabel();
    onChange(this.username);
  }

  private startEditing() {
    this.input.value = this.username;
    this.label.style.display = "none";
    this.input.style.display = "block";
    this.input.focus();
    this.input.select();
  }

  private stopEditing() {
    this.input.style.display = "none";
    this.label.style.display = "block";
    this.updateLabel();
  }

  private updateLabel() {
    this.label.textContent = `NAME: ${this.username || "Anonymous"} ✎`;
  }

  destroy(): void {
    this.root.remove();
  }
}
