import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pinStorage } from "@/features/pin/pin-utils";
import { useRelationship } from "./useRelationship";
import { KNOWN_CITIES, calculateDistanceKm, setUserCity } from "@/lib/location-service";

/** Short names read as initials: "Sj" → "SJ". */
export function displayName(raw: string | null | undefined, fallback: string) {
  const n = (raw ?? "").trim();
  if (!n) return fallback;
  return n.length <= 2 ? n.toUpperCase() : n;
}

type Slot = "a" | "b";

/**
 * The two people in this space, from the relationship record
 * (or the public space state when not signed in yet).
 */
export function useCoupleNames() {
  const { data: rel } = useRelationship();
  const { data: space } = useQuery({
    queryKey: ["space-state"],
    enabled: !rel,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_space_state");
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as { name_a: string | null; name_b: string | null } | null;
    },
  });
  const slot: Slot = (pinStorage.getSlot() as Slot | null) ?? "a";
  const nameA = rel?.name_a ?? space?.name_a ?? null;
  const nameB = rel?.name_b ?? space?.name_b ?? null;
  const me = displayName(slot === "a" ? nameA : nameB, pinStorage.getName() ?? "you");
  const partner = displayName(slot === "a" ? nameB : nameA, "your love");
  return { me, partner, slot, partnerSlot: (slot === "a" ? "b" : "a") as Slot };
}

export type Spot = { city: string; lat: number; lng: number };

const LS_SPOT = "seanaya.my_spot";
const today = () => new Date().toISOString().slice(0, 10);

/** Closest city we know by name; coordinates themselves stay exact. */
export function nearestCity(lat: number, lng: number) {
  let best = { name: "", km: Infinity };
  for (const c of Object.values(KNOWN_CITIES)) {
    const km = calculateDistanceKm(lat, lng, c.lat, c.lng);
    if (km < best.km) best = { name: c.name, km };
  }
  return best;
}

function readMySpot(): (Spot & { date?: string }) | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_SPOT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMySpot(spot: Spot) {
  localStorage.setItem(LS_SPOT, JSON.stringify({ ...spot, date: today() }));
  setUserCity(spot.city);
}

async function shareSpot(relationshipId: string, slot: Slot, spot: Spot) {
  // Requires the member_locations table (supabase/migrations). Silently skipped if absent.
  await (supabase as any)
    .from("member_locations")
    .upsert(
      {
        relationship_id: relationshipId,
        slot,
        city: spot.city,
        lat: spot.lat,
        lng: spot.lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "relationship_id,slot" },
    )
    .then(() => undefined, () => undefined);
}

export type LocationStatus = "locating" | "ok" | "denied" | "unsupported";

/**
 * Where each of you is right now. Your spot always comes from this device's location
 * (the browser asks for permission); your partner's from what their device shared.
 * Nothing here is editable by hand.
 */
export function useCoupleLocations(relationshipId: string) {
  const { slot, partnerSlot } = useCoupleNames();
  const [mine, setMine] = useState<Spot | null>(() => {
    const s = readMySpot();
    return s ? { city: s.city, lat: s.lat, lng: s.lng } : null;
  });
  const [status, setStatus] = useState<LocationStatus>(mine ? "ok" : "locating");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const spot = { city: nearestCity(lat, lng).name, lat, lng };
        saveMySpot(spot);
        setMine(spot);
        setStatus("ok");
        if (relationshipId) shareSpot(relationshipId, slot, spot);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : mine ? "ok" : "unsupported"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 30 * 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId, slot]);

  const { data: partner } = useQuery({
    queryKey: ["member-locations", relationshipId, partnerSlot],
    enabled: !!relationshipId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("member_locations")
        .select("city,lat,lng,updated_at")
        .eq("relationship_id", relationshipId)
        .eq("slot", partnerSlot)
        .maybeSingle();
      if (error) return null;
      return (data ?? null) as (Spot & { updated_at: string }) | null;
    },
  });

  return {
    mine,
    status,
    partner: partner ?? null,
    distanceKm:
      mine && partner ? calculateDistanceKm(mine.lat, mine.lng, partner.lat, partner.lng) : null,
  };
}
