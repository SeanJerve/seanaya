export type PhotoCut = {
  id: string;
  dataUrl: string; // Base64 or Blob URL of the captured frame
  capturedBy: "a" | "b" | "combined";
  timestamp: number;
};

export type FrameId =
  "korean-classic" | "lily-romance" | "ldr-journey" | "retro-y2k" | "polaroid-duo";

export type FilterId = "normal" | "noir" | "pastel" | "vintage" | "warm";

export interface FrameTemplate {
  id: FrameId;
  name: string;
  description: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  aspectRatio: "strip" | "grid" | "polaroid"; // strip: 1:3 vertical, grid: 2:2, polaroid: 3:4
  cutCount: number; // 4 for strip/grid, 2 for polaroid
  hasLilyMotif?: boolean;
  hasLdrTag?: boolean;
}

export interface PlacedSticker {
  id: string;
  src: string;
  xPercent: number; // 0 to 100 relative to strip
  yPercent: number; // 0 to 100 relative to strip
  scale: number;
  rotation: number;
  placedBy: string;
}

export type ShootStage =
  | "setup" // Preparing camera, waiting for partner
  | "ready" // Both ready in booth
  | "countdown" // 3... 2... 1...
  | "capturing" // Snapping the 4 cuts
  | "review" // Decorating with frames, stickers, filters
  | "exporting"; // Rendering canvas & saving to album
