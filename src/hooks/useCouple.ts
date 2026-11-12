import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pinStorage } from "@/features/pin/pin-utils";
import { useRelationship } from "./useRelationship";
import {
  KNOWN_CITIES,
  calculateDistanceKm,
  getPartnerCity,
  resolveCity,
  setUserCity,
} from "@/lib/location-service";

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

/**
 * Where each of you is today. Your spot comes from the device once a day
 * (or a manual pick); your partner's comes from what their device shared.
 */
export function useCoupleLocations(relationshipId: string) {
  const qc = useQueryClient();
  const { slot, partnerSlot } = useCoupleNames();
  const [mine, setMine] = useState<Spot>(() => {
    const s = readMySpot();
    if (s) return { city: s.city, lat: s.lat, lng: s.lng };
    const c = resolveCity("Bacolod");
    return { city: c.name, lat: c.lat, lng: c.lng };
  });

  const locateMe = (onDone?: (ok: boolean) => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return onDone?.(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const spot = { city: nearestCity(lat, lng).name, lat, lng };
        saveMySpot(spot);
        setMine(spot);
        if (relationshipId) shareSpot(relationshipId, slot, spot);
        onDone?.(true);
      },
      () => onDone?.(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60 * 60_000 },
    );
  };

  // Refresh from the device once per day.
  useEffect(() => {
    if (readMySpot()?.date === today()) return;
    locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId, slot]);

  const { data: sharedPartner } = useQuery({
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

  const [partnerManual, setPartnerManual] = useState(() => getPartnerCity());
  const partner: Spot = useMemo(() => {
    if (sharedPartner) return sharedPartner;
    const c = resolveCity(partnerManual);
    return { city: c.name, lat: c.lat, lng: c.lng };
  }, [sharedPartner, partnerManual]);

  const setMyCity = (city: string) => {
    const c = resolveCity(city);
    const spot = { city: c.name, lat: c.lat, lng: c.lng };
    saveMySpot(spot);
    setMine(spot);
    if (relationshipId) {
      shareSpot(relationshipId, slot, spot).then(() =>
        qc.invalidateQueries({ queryKey: ["member-locations"] }),
      );
    }
  };

  return {
    mine,
    partner,
    partnerIsShared: !!sharedPartner,
    distanceKm: calculateDistanceKm(mine.lat, mine.lng, partner.lat, partner.lng),
    setMyCity,
    setPartnerManual,
    locateMe,
  };
}
