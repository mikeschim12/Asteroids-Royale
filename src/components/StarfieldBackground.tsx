"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    const STAR_COUNT = 220;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const seed = () => {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height,
        z: Math.random() * width,
      }));
    };

    const handleResize = () => {
      resize();
      seed();
    };

    resize();
    seed();
    window.addEventListener("resize", handleResize);

    let raf = 0;
    const speed = 0.35;

    const draw = () => {
      ctx.fillStyle = "#05050a";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (const star of stars) {
        star.z -= speed * 8;
        if (star.z <= 0) star.z = width;

        const k = 128 / star.z;
        const x = star.x * k + cx;
        const y = star.y * k + cy;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const size = Math.max(0.4, (1 - star.z / width) * 2.2);
        const alpha = Math.min(1, (1 - star.z / width) * 1.3);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, size, size);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
    />
  );
}
