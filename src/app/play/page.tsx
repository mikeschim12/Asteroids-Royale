import type { Viewport } from "next";
import GameCanvas from "@/components/GameCanvas";

export const metadata = {
  title: "Play — Royale.Rocks",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PlayPage() {
  return <GameCanvas />;
}
