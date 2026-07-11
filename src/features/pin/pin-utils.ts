export const ANNIVERSARY_ISO = "2026-06-19";
const LS_PIN = "seanaya.pin_hash";
const LS_NAME = "seanaya.display_name";

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`seanaya:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const pinStorage = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_PIN)),
  set: (hash: string) => localStorage.setItem(LS_PIN, hash),
  clear: () => localStorage.removeItem(LS_PIN),
  getName: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_NAME)),
  setName: (n: string) => localStorage.setItem(LS_NAME, n),
};

export function isAnniversaryMatch(input: string): boolean {
  // Accept 2026-06-19 or 06/19/2026 or 19/06/2026 or June 19 2026
  const s = input.trim().toLowerCase().replace(/[,.]/g, "");
  if (s === ANNIVERSARY_ISO) return true;
  const patterns = [
    /^2026[-/]06[-/]19$/,
    /^06[-/]19[-/]2026$/,
    /^19[-/]06[-/]2026$/,
    /^june\s*19\s*2026$/,
    /^jun\s*19\s*2026$/,
  ];
  return patterns.some((r) => r.test(s));
}
