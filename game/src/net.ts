import { GameState, ShipIntent, SimEvent } from "./simulation";

interface WelcomeMessage {
  type: "welcome";
  yourShipId: number;
  worldWidth: number;
  worldHeight: number;
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
  onClose(): void;
  onError(): void;
}

export class NetworkClient {
  private ws: WebSocket | null = null;

  connect(url: string, callbacks: NetworkClientCallbacks) {
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        callbacks.onWelcome(msg.yourShipId, msg.worldWidth, msg.worldHeight);
      } else if (msg.type === "state") {
        callbacks.onState(msg.state, msg.events, msg.connectedCount);
      }
    };
    ws.onclose = () => callbacks.onClose();
    ws.onerror = () => callbacks.onError();
  }

  sendInput(intent: ShipIntent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "input", ...intent }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
