import { MAX_NAME_LENGTH, sanitizeName } from "../lib/nameFilter";

const STORAGE_KEY = "asteroids-royale:username";

export function loadUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    return sanitizeName(window.localStorage.getItem(STORAGE_KEY) ?? "");
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
      // Absolute (not fixed) so this sits relative to the game's own
      // container -- which starts below the site header -- instead of the
      // viewport's top edge, where it would overlap the header bar.
      position: "absolute",
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
    this.input.maxLength = MAX_NAME_LENGTH;
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

    // On Enter, a rejected name (blocked word, or nothing left after
    // stripping) keeps the editor open with a hint instead of silently
    // reverting to "Anonymous" -- the player typed something and should
    // see why it didn't take. Losing focus (blur) just commits whatever's
    // valid, same as before, so clicking away doesn't trap the input.
    const commit = (keepOpenIfRejected: boolean) => {
      const cleaned = sanitizeName(this.input.value);
      if (!cleaned && this.input.value.trim() && keepOpenIfRejected) {
        this.input.value = "";
        this.input.placeholder = "Try a different name";
        return;
      }
      this.username = cleaned;
      saveUsername(cleaned);
      onChange(cleaned);
      this.stopEditing();
    };

    this.label.addEventListener("click", () => this.startEditing());
    // The game's own key handling listens on `window`; stop these events
    // from bubbling there so typing a name doesn't also fire in-game
    // actions (Space to fire, M to switch mode, WASD to move, etc).
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") commit(true);
      else if (e.key === "Escape") this.stopEditing();
    });
    this.input.addEventListener("keyup", (e) => e.stopPropagation());
    this.input.addEventListener("blur", () => commit(false));

    this.updateLabel();
    onChange(this.username);
  }

  /**
   * Opens the name editor if no name has been chosen yet. Used to require
   * picking a display name before joining online play (see engine.ts) --
   * deliberately never defaults to the player's real Google account name,
   * so nothing identifying shows up to opponents unless typed in here.
   */
  requireName(): void {
    if (!this.username) this.startEditing();
  }

  private startEditing() {
    this.input.value = this.username;
    this.input.placeholder = "Your name";
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
