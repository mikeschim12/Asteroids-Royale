import { GameState, ShipIntent, SimEvent } from "./simulation";

interface WelcomeMessage {
  type: "welcome";
  yourShipId: number;
  worldWidth: number;
  worldHeight: number;
  token: string;
}

interface StateMessage {
  type: "state";
  state: GameState;
  events: SimEvent[];
  connectedCount: number;
}

type ServerMessage = WelcomeMessage | StateMessage;

export interface NetworkClientCallbacks {
  onWelcome(yourShipId: number, worldWidth: number, worldHeight: number): void;
  onState(state: GameState, events: SimEvent[], connectedCount: number): void;
  /** Connection dropped and a reconnect attempt is scheduled (not a deliberate disconnect()). */
  onReconnecting(attempt: number, delayMs: number): void;
  onClose(): void;
  onError(): void;
}

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000];
const MAX_RECONNECT_DELAY_MS = 8000;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url = "";
  private callbacks: NetworkClientCallbacks | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Set from the server's "welcome" message and reused on auto-reconnect so
  // a dropped connection resumes the same ship instead of joining as a new
  // one -- reset to null on a fresh, deliberate connect().
  private token: string | null = null;

  connect(url: string, callbacks: NetworkClientCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
    this.intentionalClose = false;
    this.reconnectAttempt = 0;
    this.token = null;
    this.open();
  }

  private open() {
    const callbacks = this.callbacks;
    if (!callbacks) return;

    const url = this.token
      ? `${this.url}${this.url.includes("?") ? "&" : "?"}token=${encodeURIComponent(this.token)}`
      : this.url;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        this.token = msg.token;
        callbacks.onWelcome(msg.yourShipId, msg.worldWidth, msg.worldHeight);
      } else if (msg.type === "state") {
        callbacks.onState(msg.state, msg.events, msg.connectedCount);
      }
    };
    ws.onclose = () => {
      if (this.intentionalClose) {
        callbacks.onClose();
        return;
      }
      const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? MAX_RECONNECT_DELAY_MS;
      this.reconnectAttempt += 1;
      callbacks.onReconnecting(this.reconnectAttempt, delay);
      this.reconnectTimer = setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => callbacks.onError();
  }

  sendInput(intent: ShipIntent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "input", ...intent }));
    }
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.callbacks = null;
  }
}
