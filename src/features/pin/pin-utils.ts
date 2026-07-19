export const ANNIVERSARY_ISO = "2026-06-19";
const LS_NAME = "seanaya.display_name";
const LS_SLOT = "seanaya.active_slot";
const LS_REL = "seanaya.rel_id";
// legacy — no longer used for gating, kept for reads only
const LS_PIN = "seanaya.pin_hash";
const LS_INVITE = "seanaya.invite_code";

export type Slot = "a" | "b";

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`seanaya:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const pinStorage = {
  getName: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_NAME)),
  setName: (n: string) => localStorage.setItem(LS_NAME, n),
  getSlot: (): Slot | null =>
    typeof window === "undefined" ? null : (localStorage.getItem(LS_SLOT) as Slot | null),
  setSlot: (s: Slot) => localStorage.setItem(LS_SLOT, s),
  clearSlot: () => localStorage.removeItem(LS_SLOT),
  getRel: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_REL)),
  setRel: (id: string) => localStorage.setItem(LS_REL, id),
  // Legacy shims (still referenced by some settings UI)
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_PIN)),
  set: (h: string) => localStorage.setItem(LS_PIN, h),
  getInvite: () => (typeof window === "undefined" ? null : localStorage.getItem(LS_INVITE)),
  setInvite: (c: string) => localStorage.setItem(LS_INVITE, c.toUpperCase()),
};

export function isAnniversaryMatch(input: string, iso = ANNIVERSARY_ISO): boolean {
  const s = input.trim().toLowerCase().replace(/[,.]/g, "");
  if (s === iso) return true;
  const [y, m, d] = iso.split("-");
  const patterns = [
    new RegExp(`^${y}[-/]${m}[-/]${d}$`),
    new RegExp(`^${m}[-/]${d}[-/]${y}$`),
    new RegExp(`^${d}[-/]${m}[-/]${y}$`),
  ];
  return patterns.some((r) => r.test(s));
}
