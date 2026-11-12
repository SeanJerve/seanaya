import type { FrameTemplate } from "./types";

export const FRAME_TEMPLATES: FrameTemplate[] = [
  {
    id: "korean-classic",
    name: "Life4Cuts Classic",
    description: "Korean matte black minimalist strip with clean white serif typography",
    bgColor: "#1a1a1a",
    textColor: "#f3f4f6",
    accentColor: "#ffffff",
    aspectRatio: "strip",
    cutCount: 4,
  },
  {
    id: "lily-romance",
    name: "Lily Romance",
    description: "Pastel sky-blue with delicate white lily illustrations & soft borders",
    bgColor: "oklch(0.96 0.03 235)",
    textColor: "oklch(0.32 0.05 255)",
    accentColor: "oklch(0.68 0.09 240)",
    aspectRatio: "strip",
    cutCount: 4,
    hasLilyMotif: true,
  },
  {
    id: "ldr-journey",
    name: "LDR Distance Special",
    description: "Bacolod to Partner City — Dual timezones, calculated distance & postal stamps",
    bgColor: "#faf6eb",
    textColor: "#453823",
    accentColor: "#d97706",
    aspectRatio: "strip",
    cutCount: 4,
    hasLdrTag: true,
  },
  {
    id: "retro-y2k",
    name: "Y2K Kawaii",
    description: "Bubblegum pastel pink with sparkles, chrome stars & pixel hearts",
    bgColor: "#fdf2f8",
    textColor: "#9d174d",
    accentColor: "#ec4899",
    aspectRatio: "grid",
    cutCount: 4,
  },
  {
    id: "polaroid-duo",
    name: "Polaroid Keepsake",
    description: "Wide vintage instant photo frame with handwritten note space",
    bgColor: "#ffffff",
    textColor: "#1f2937",
    accentColor: "#6b7280",
    aspectRatio: "polaroid",
    cutCount: 2,
  },
];

export const PHOTO_FILTERS: { id: string; name: string; cssFilter: string }[] = [
  { id: "normal", name: "Natural", cssFilter: "none" },
  { id: "noir", name: "Noir Film", cssFilter: "grayscale(100%) contrast(115%) brightness(95%)" },
  { id: "pastel", name: "Soft Glow", cssFilter: "brightness(106%) saturate(110%) contrast(96%)" },
  {
    id: "vintage",
    name: "Warm Portra",
    cssFilter: "sepia(25%) contrast(105%) brightness(102%) saturate(115%)",
  },
  {
    id: "warm",
    name: "Golden Hour",
    cssFilter: "sepia(15%) saturate(130%) hue-rotate(-10deg) brightness(104%)",
  },
];

export const BOOTH_STICKERS = [
  { id: "lily", src: "/main-lily.webp", label: "White Lily" },
  { id: "couple", src: "/couple-sticker.webp", label: "Sean & Aya" },
  { id: "sticker_0", src: "/stickers/sticker_0_dbf609.png", label: "Sweet Kiss" },
  { id: "sticker_1", src: "/stickers/sticker_1_25567c.png", label: "Cute Hug" },
  { id: "sticker_3", src: "/stickers/sticker_3_311950.png", label: "Star Sparkle" },
  { id: "sticker_4", src: "/stickers/sticker_4_8591e5.png", label: "Heart" },
  { id: "sticker_5", src: "/stickers/sticker_5_6523c4.png", label: "Love Note" },
  { id: "sticker_6", src: "/stickers/sticker_6_b7873e.png", label: "Bouquet" },
  { id: "sticker_7", src: "/stickers/sticker_7_b6c6c2.png", label: "Soft Bow" },
];
