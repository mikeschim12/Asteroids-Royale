"use client";

import { useEffect, useRef } from "react";
import { startGame } from "@/game/engine";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const stop = startGame(canvas);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  return (
    <div className="relative flex-1 flex touch-none select-none overscroll-none">
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />
    </div>
  );
}
