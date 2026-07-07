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

    const stop = startGame(canvas);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="flex-1 flex">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
