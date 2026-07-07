/**
 * Game engine integration contract.
 *
 * The website mounts the game by calling `startGame` with a canvas element.
 * Replace `startGame` below with the real game loop — the signature must
 * stay the same so `src/components/GameCanvas.tsx` keeps working.
 */
export type StopGame = () => void;

export function startGame(canvas: HTMLCanvasElement): StopGame {
  const ctx = canvas.getContext("2d");
  let frame = 0;
  let raf = 0;

  const render = () => {
    if (!ctx) return;
    frame += 1;
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Game engine placeholder — waiting for the real thing",
      canvas.width / 2,
      canvas.height / 2,
    );
    ctx.fillText(`frame ${frame}`, canvas.width / 2, canvas.height / 2 + 24);
    raf = requestAnimationFrame(render);
  };

  raf = requestAnimationFrame(render);

  return () => cancelAnimationFrame(raf);
}
