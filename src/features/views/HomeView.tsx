import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  differenceInDays,
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  getDay,
  isSameMonth,
  addMonths,
} from "date-fns";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Camera,
  Heart,
  Calendar as CalendarIcon,
  BookHeart,
  PenSquare,
  Clock,
  Compass,
  ArrowUpRight,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Lightbox } from "@/lib/Lightbox";
import { useUser } from "@/hooks/useUser";
import { useRelationship } from "@/hooks/useRelationship";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";
import {
  getUserCity,
  setUserCity,
  getPartnerCity,
  setPartnerCity,
  resolveCity,
  calculateDistanceKm,
  getLiveTimeInTimezone,
  getTimezoneOffsetDescription,
  getSolarState,
  KNOWN_CITIES,
} from "@/lib/location-service";

export function HomeView({
  relationshipId,
  anniversary,
}: {
  relationshipId: string;
  anniversary: string | null;
}) {
  const name = pinStorage.getName() ?? "you";
  const { openSheet, setTab, openMonthsary } = useAppStore();
  const { user } = useUser();
  const { data: rel } = useRelationship();
  const partnerName = rel
    ? (rel.user_a_id === user?.id ? rel.name_b : rel.name_a) || "Partner"
    : "Partner";

  // Dynamic Location State
  const [userCity, setUserCityLocal] = useState(() => getUserCity());
  const [partnerCity, setPartnerCityLocal] = useState(() => getPartnerCity());
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [tempPartnerCity, setTempPartnerCity] = useState(partnerCity);

  useEffect(() => {
    const handleLocationUpdate = () => {
      setUserCityLocal(getUserCity());
      setPartnerCityLocal(getPartnerCity());
    };
    window.addEventListener("seanaya:location_updated", handleLocationUpdate);
    return () => window.removeEventListener("seanaya:location_updated", handleLocationUpdate);
  }, []);

  const userCityProfile = useMemo(() => resolveCity(userCity), [userCity]);
  const partnerCityProfile = useMemo(() => resolveCity(partnerCity), [partnerCity]);

  const distanceKm = useMemo(() => {
    return calculateDistanceKm(
      userCityProfile.lat,
      userCityProfile.lng,
      partnerCityProfile.lat,
      partnerCityProfile.lng,
    );
  }, [userCityProfile, partnerCityProfile]);

  // Live Dual Clocks
  const [nowDate, setNowDate] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const localTime = useMemo(() => {
    return getLiveTimeInTimezone(userCityProfile.timezone, nowDate);
  }, [userCityProfile.timezone, nowDate]);

  const partnerTime = useMemo(() => {
    return getLiveTimeInTimezone(partnerCityProfile.timezone, nowDate);
  }, [partnerCityProfile.timezone, nowDate]);

  const tzDifference = useMemo(() => {
    return getTimezoneOffsetDescription(
      userCityProfile.timezone,
      partnerCityProfile.timezone,
      nowDate,
    );
  }, [userCityProfile.timezone, partnerCityProfile.timezone, nowDate]);

  const userSolar = useMemo(() => getSolarState(localTime.hour24), [localTime.hour24]);
  const partnerSolar = useMemo(() => getSolarState(partnerTime.hour24), [partnerTime.hour24]);

  const { data: recentAction, isLoading: loadingAction } = useQuery({
    queryKey: ["recent-partner-action", relationshipId, user?.id],
    enabled: !!user && !!relationshipId,
    queryFn: async () => {
      const { data: rel } = await supabase
        .from("relationships")
        .select("*")
        .eq("id", relationshipId)
        .single();
      if (!rel) return null;
      const partnerId = rel.user_a_id === user!.id ? rel.user_b_id : rel.user_a_id;
      if (!partnerId) return null;

      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", partnerId)
        .maybeSingle();
      const pName = rel.user_a_id === user!.id ? rel.name_b : rel.name_a;

      const { data: latestNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("relationship_id", relationshipId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestNotif) {
        const { data: latestNote } = await supabase
          .from("notes")
          .select("*")
          .eq("relationship_id", relationshipId)
          .eq("author_id", partnerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestNote) {
          return {
            partnerName: pName || "Partner",
            partnerAvatar: partnerProfile?.avatar_url,
            kind: "note",
            createdAt: latestNote.created_at,
            item: latestNote,
            text: "pinned a quiet thought",
          };
        }
        return null;
      }

      if (!latestNotif.ref_id) return null;

      let item: any = null;
      let text = "shared a moment";
      if (latestNotif.kind === "note") {
        const { data } = await supabase
          .from("notes")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = data?.kind === "photo" ? "shared a polaroid" : "pinned a note";
      } else if (latestNotif.kind === "memory") {
        const { data } = await supabase
          .from("memories")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "recorded a memory";
      } else if (latestNotif.kind === "trip") {
        const { data } = await supabase
          .from("trips")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "pinned a destination";
      } else if (latestNotif.kind === "event") {
        const { data } = await supabase
          .from("events")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "scheduled an occasion";
      } else if (latestNotif.kind === "song") {
        const { data } = await supabase
          .from("songs")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "shared a melody";
      } else if (latestNotif.kind === "hug") {
        const { data } = await supabase
          .from("hugs")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "sent a warm embrace";
      }

      return {
        partnerName: pName || "Partner",
        partnerAvatar: partnerProfile?.avatar_url,
        kind: latestNotif.kind,
        createdAt: latestNotif.created_at,
        item,
        text,
      };
    },
  });

  const [lightbox, setLightbox] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);

  useEffect(() => {
    const key = "intro-dismissed-home";
    const val = localStorage.getItem(key);
    if (!val) {
      setShowLongPressInfo(true);
      localStorage.setItem(key, "true");
    }
  }, []);

  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => {},
  });

  const { data: monthEvents = [] } = useQuery({
    queryKey: ["events", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const s = startOfMonth(cursor).toISOString();
      const e = endOfMonth(cursor).toISOString();
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("relationship_id", relationshipId)
        .gte("starts_at", s)
        .lte("starts_at", e)
        .order("starts_at");
      return data ?? [];
    },
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["stats", relationshipId],
    queryFn: async () => {
      const [mem, trip, hug, next, recent] = await Promise.all([
        supabase
          .from("memories")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", relationshipId),
        supabase
          .from("trips")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", relationshipId),
        supabase
          .from("hugs")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", relationshipId),
        supabase
          .from("events")
          .select("*")
          .eq("relationship_id", relationshipId)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(1),
        supabase
          .from("memories")
          .select("id,title,memory_date,cover_url")
          .eq("relationship_id", relationshipId)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      return {
        memories: mem.count ?? 0,
        trips: trip.count ?? 0,
        hugs: hug.count ?? 0,
        nextEvent: next.data?.[0] ?? null,
        recent: recent.data ?? [],
      };
    },
  });

  const { data: monthPhotos = [] } = useQuery({
    queryKey: ["photos-cal-home", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const sStart = startOfMonth(cursor).toISOString();
      const sEnd = endOfMonth(cursor).toISOString();
      const sDateStart = format(startOfMonth(cursor), "yyyy-MM-dd");
      const sDateEnd = format(endOfMonth(cursor), "yyyy-MM-dd");

      const [mems, notes] = await Promise.all([
        supabase
          .from("memories")
          .select("id,memory_date,cover_url,title")
          .eq("relationship_id", relationshipId)
          .gte("memory_date", sDateStart)
          .lte("memory_date", sDateEnd)
          .not("cover_url", "is", null),
        supabase
          .from("notes")
          .select("id,created_at,image_url,body")
          .eq("relationship_id", relationshipId)
          .eq("kind", "photo")
          .gte("created_at", sStart)
          .lte("created_at", sEnd)
          .not("image_url", "is", null),
      ]);

      const list: { dateStr: string; url: string; title: string }[] = [];
      mems.data?.forEach((m) => {
        if (m.memory_date && m.cover_url) {
          list.push({ dateStr: m.memory_date, url: m.cover_url, title: m.title });
        }
      });
      notes.data?.forEach((n) => {
        if (n.created_at && n.image_url) {
          const dStr = format(new Date(n.created_at), "yyyy-MM-dd");
          list.push({
            dateStr: dStr,
            url: n.image_url,
            title: n.body !== "(photo)" ? n.body : "Photo Pin",
          });
        }
      });
      return list;
    },
  });

  const today = new Date();
  const isMonthsary = today.getDate() === 19;
  const start = new Date((anniversary || "2026-06-19") + "T00:00:00");

  const [timeTogether, setTimeTogether] = useState<{
    totalDays: number;
    years: number;
    months: number;
    days: number;
    hours: number;
    mins: number;
    secs: number;
  } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let diffMs = now.getTime() - start.getTime();
      if (diffMs < 0) diffMs = 0;

      const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const hours = diffHours % 24;
      const mins = diffMins % 60;
      const secs = diffSecs % 60;

      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      if (months < 0 || (months === 0 && now.getDate() < start.getDate())) {
        years--;
        months = 12 + months;
      }
      if (now.getDate() < start.getDate()) {
        months--;
      }

      const tempDate = new Date(start);
      tempDate.setFullYear(start.getFullYear() + years);
      tempDate.setMonth(start.getMonth() + months);
      const remainingDays = Math.floor(
        (now.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      setTimeTogether({
        totalDays,
        years,
        months: months >= 0 ? months : 0,
        days: remainingDays >= 0 ? remainingDays : 0,
        hours,
        mins,
        secs,
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [anniversary]);

  const gridDays = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));

  const nextMonthsaryDate = useMemo(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), 19, 0, 0, 0);
    if (now.getDate() >= 19) {
      target = new Date(now.getFullYear(), now.getMonth() + 1, 19, 0, 0, 0);
    }
    return target;
  }, []);

  const daysToNextMonthsary = useMemo(() => {
    return Math.max(0, differenceInDays(nextMonthsaryDate, new Date()));
  }, [nextMonthsaryDate]);

  const cycleProgress = useMemo(() => {
    const cycleTotal = 30;
    const daysElapsed = Math.max(0, Math.min(cycleTotal, cycleTotal - daysToNextMonthsary));
    return Math.round((daysElapsed / cycleTotal) * 100);
  }, [daysToNextMonthsary]);

  const qc = useQueryClient();
  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase
        .from("hugs")
        .insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`A quiet embrace sent to ${partnerName}`);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <div className="mx-auto max-w-md md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 py-6 pb-32">
      {/* ── Monthsary Celebration Banner ── */}
      {isMonthsary && (
        <section
          onClick={openMonthsary}
          className="mb-6 cursor-pointer relative overflow-hidden rounded-2xl border border-rose-300/40 bg-gradient-to-r from-rose-50/80 via-white/80 to-amber-50/60 backdrop-blur-2xl p-4 shadow-sm hover:border-rose-400/50 transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-serif text-base font-medium tracking-tight text-foreground flex items-center gap-2">
                <span>Happy Monthsary, {partnerName}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
              </div>
              <p className="text-xs text-muted-foreground font-light">
                Our milestone story is ready to unfold. Tap to view.
              </p>
            </div>
            <span className="text-xs font-medium tracking-wide text-foreground/80 px-3 py-1.5 rounded-full border border-foreground/10 bg-white/70 shadow-2xs group-hover:bg-white transition-colors">
              Open Story
            </span>
          </div>
        </section>
      )}

      {/* ── Responsive 2-Column Spread ── */}
      <div className="md:grid md:grid-cols-12 md:gap-7 space-y-6 md:space-y-0 items-start">
        {/* Left Column: Transit Bar, Daily Greeting, What Matters Today */}
        <div className="space-y-6 md:col-span-7">
          {/* ── Architectural Dual-City LDR Transit Bar ── */}
          <section className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white/75 backdrop-blur-2xl p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] space-y-4">
            {/* Header: Live sync pulse & Distance badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-foreground/70">
                  Synchronous Space
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tabular-nums text-foreground/75 px-2.5 py-0.5 rounded-full border border-black/[0.06] bg-black/[0.02]">
                  {distanceKm} km apart
                </span>
                <button
                  onClick={() => setShowCityPicker((v) => !v)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1 cursor-pointer"
                  title="Configure cities"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* In-place City Configuration Accordion */}
            {showCityPicker && (
              <div className="p-3.5 rounded-2xl border border-black/[0.06] bg-black/[0.015] space-y-3">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span>Update Partner City</span>
                  <button
                    onClick={() => setShowCityPicker(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPartnerCity}
                    onChange={(e) => setTempPartnerCity(e.target.value)}
                    placeholder="Enter city (e.g. Manila, Cebu, Tokyo)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-black/10 bg-white text-xs outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => {
                      const c = tempPartnerCity.trim() || "Manila";
                      setPartnerCity(c);
                      setPartnerCityLocal(c);
                      setShowCityPicker(false);
                      toast.success(`Partner city set to ${c}`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                  >
                    <Check size={12} />
                    Apply
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "Manila",
                    "Cebu City",
                    "Iloilo City",
                    "Davao City",
                    "Dumaguete",
                    "Baguio",
                    "Tokyo",
                    "Vancouver",
                  ].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setPartnerCity(c);
                        setPartnerCityLocal(c);
                        setTempPartnerCity(c);
                        setShowCityPicker(false);
                        toast.success(`Partner city updated: ${c}`);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-black/5 bg-white/60 hover:bg-white text-foreground/80 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dual City Visual Architecture */}
            <div className="grid grid-cols-12 items-center gap-2 p-3.5 rounded-2xl border border-black/[0.05] bg-gradient-to-b from-white/90 to-white/50">
              {/* User City (Left) */}
              <div className="col-span-5 min-w-0 space-y-0.5">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                  {name}
                </div>
                <div className="font-serif text-base font-semibold text-foreground truncate">
                  {userCity}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-foreground/85">
                  <Clock size={11} className="text-muted-foreground shrink-0" />
                  <span>{localTime.timeStr}</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-light">
                  {userSolar.phase} · {userSolar.mood}
                </div>
              </div>

              {/* Transit Bridge (Center) */}
              <div className="col-span-2 flex flex-col items-center justify-center text-center px-1">
                <div className="w-full flex items-center justify-center">
                  <div className="h-px w-full bg-gradient-to-r from-foreground/10 via-foreground/30 to-foreground/10" />
                </div>
                <span className="font-serif text-xs italic text-muted-foreground mt-1 tracking-tight">
                  to
                </span>
              </div>

              {/* Partner City (Right) */}
              <div className="col-span-5 min-w-0 text-right space-y-0.5">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                  {partnerName}
                </div>
                <div className="font-serif text-base font-semibold text-foreground truncate">
                  {partnerCity}
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs font-mono tabular-nums text-foreground/85">
                  <span>{partnerTime.timeStr}</span>
                  <Clock size={11} className="text-muted-foreground shrink-0" />
                </div>
                <div className="text-[10px] text-muted-foreground font-light">
                  {partnerSolar.phase} · {partnerSolar.mood}
                </div>
              </div>
            </div>

            {/* Timezone relationship caption */}
            <div className="text-center text-[10px] text-muted-foreground tracking-wide">
              <span>{tzDifference}</span>
              <span className="mx-1.5 text-foreground/20">/</span>
              <span>
                Coordinates: {userCityProfile.lat.toFixed(1)}°N ·{" "}
                {partnerCityProfile.lat.toFixed(1)}°N
              </span>
            </div>

            {/* Action Bar: Editorial Layout */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-black/[0.04]">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([40, 80, 40]);
                  }
                  hug.mutate();
                }}
                disabled={hug.isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-rose-200/50 bg-rose-50/40 hover:bg-rose-50/80 active:scale-[0.98] transition-all cursor-pointer group text-xs font-medium text-rose-950"
              >
                <Heart
                  size={13}
                  className="text-rose-600 fill-rose-600/30 group-hover:scale-110 transition-transform"
                />
                <span>Send Hug</span>
              </button>

              <button
                onClick={() => openSheet("add-note")}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white active:scale-[0.98] transition-all cursor-pointer text-xs font-medium text-foreground/80"
              >
                <PenSquare size={13} className="text-muted-foreground" />
                <span>Leave Note</span>
              </button>

              <button
                onClick={() => openSheet("add-memory")}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-black/[0.06] bg-white/80 hover:bg-white active:scale-[0.98] transition-all cursor-pointer text-xs font-medium text-foreground/80"
              >
                <Plus size={13} className="text-muted-foreground" />
                <span>Add Memory</span>
              </button>
            </div>
          </section>

          {/* ── Greeting & Partner Activity Journal Strip ── */}
          <section className="rounded-3xl border border-black/[0.06] bg-white/75 backdrop-blur-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06]">
              {/* Left: Intimate Greeting */}
              <div
                {...longPressProps}
                className="p-5 flex flex-col justify-between cursor-pointer hover:bg-black/[0.015] transition-colors"
                title="Hold to view space guide"
              >
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Home
                  </div>
                  <div className="font-serif text-2xl font-normal text-foreground leading-tight tracking-tight">
                    Welcome back, {name}.
                  </div>
                </div>

                {timeTogether && (
                  <div className="mt-4 pt-4 border-t border-black/[0.04] space-y-1">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                      Together
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-3xl font-semibold text-foreground tracking-tight">
                        {timeTogether.totalDays}
                      </span>
                      <span className="font-serif italic text-sm text-muted-foreground">
                        days of devotion
                      </span>
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-foreground/60 tracking-wider">
                      {String(timeTogether.hours).padStart(2, "0")}h{" "}
                      {String(timeTogether.mins).padStart(2, "0")}m{" "}
                      {String(timeTogether.secs).padStart(2, "0")}s
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Partner's Latest Touchpoint */}
              <div
                onClick={() => {
                  if (!recentAction) return;
                  if (recentAction.kind === "wall" || recentAction.kind === "note") {
                    setTab("wall");
                  } else if (recentAction.kind === "memory") {
                    setTab("memories");
                  } else if (recentAction.kind === "event") {
                    setTab("calendar");
                  }
                }}
                className="p-5 flex flex-col justify-between cursor-pointer hover:bg-black/[0.015] transition-colors group"
                title="View partner activity"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Partner Chronicle
                  </div>
                  <ArrowUpRight
                    size={13}
                    className="text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                  />
                </div>

                <div className="my-3 min-h-[70px] flex items-center">
                  {loadingAction ? (
                    <div className="space-y-2 w-full animate-pulse">
                      <div className="h-3 w-24 bg-black/5 rounded" />
                      <div className="h-8 w-full bg-black/5 rounded-xl" />
                    </div>
                  ) : recentAction ? (
                    <div className="space-y-2 w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-black/10 bg-black/5 flex items-center justify-center text-[10px] font-medium shrink-0">
                          {recentAction.partnerAvatar ? (
                            <img
                              src={recentAction.partnerAvatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            recentAction.partnerName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {recentAction.partnerName} {recentAction.text}
                        </span>
                      </div>

                      {recentAction.item?.cover_url || recentAction.item?.image_url ? (
                        <div className="h-16 w-full rounded-xl overflow-hidden border border-black/5 bg-black/5">
                          <img
                            src={recentAction.item.cover_url || recentAction.item.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : recentAction.item?.body ? (
                        <div className="rounded-xl border border-black/5 bg-black/[0.02] p-2.5 text-xs text-foreground/85 line-clamp-2 italic font-serif">
                          "{recentAction.item.body}"
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {recentAction.item?.title || "A quiet touch"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground font-light">
                      No moments shared yet today. Leave a note or send a hug.
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground font-mono">
                  {recentAction
                    ? format(new Date(recentAction.createdAt), "MMM d · h:mm a")
                    : "Synchronized"}
                </div>
              </div>
            </div>
          </section>

          {/* ── What Matters Today ── */}
          <section className="rounded-3xl border border-black/[0.06] bg-white/75 backdrop-blur-2xl p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Upcoming Moments
              </span>
              <button
                onClick={() => setTab("calendar")}
                className="text-xs font-medium text-foreground/75 hover:text-foreground transition-colors cursor-pointer"
              >
                Calendar
              </button>
            </div>

            {loadingStats ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-14 rounded-2xl bg-black/5" />
              </div>
            ) : stats?.nextEvent ? (
              <button
                onClick={() => setTab("calendar")}
                className="w-full text-left p-4 rounded-2xl border border-black/[0.05] bg-white/80 hover:bg-white transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="font-serif text-base font-semibold text-foreground">
                    {stats.nextEvent.title}
                  </div>
                  <div className="text-xs text-muted-foreground font-light">
                    {format(new Date(stats.nextEvent.starts_at), "EEEE, MMMM d · h:mm a")}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-full border border-black/5 bg-black/[0.03] text-[11px] font-mono tabular-nums text-foreground/80">
                    in{" "}
                    {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), new Date()))}
                    d
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => openSheet("add-event")}
                className="w-full p-4 rounded-2xl border border-dashed border-black/15 bg-black/[0.015] hover:bg-black/[0.03] transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Plus size={13} />
                <span>Schedule a shared date or call</span>
              </button>
            )}
          </section>
        </div>

        {/* Right Column: Remote Photo Booth Studio, Milestone Ring & Calendar */}
        <div className="space-y-6 md:col-span-5">
          {/* ── Remote Photo Booth Invitation Card ── */}
          <section
            onClick={() => setTab("photobooth")}
            className="cursor-pointer relative overflow-hidden rounded-3xl border border-black/[0.07] bg-gradient-to-br from-white/95 via-stone-50/80 to-amber-50/40 backdrop-blur-2xl p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] hover:border-black/15 transition-all active:scale-[0.99] group touch-manipulation space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Studio
              </span>
              <span className="text-[10px] font-medium tracking-wide text-foreground/80 px-2.5 py-0.5 rounded-full border border-black/10 bg-white shadow-2xs">
                Synchronized
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-serif text-lg font-medium text-foreground tracking-tight flex items-center justify-between">
                <span>Remote LDR Photo Booth</span>
                <Camera
                  size={18}
                  className="text-foreground/70 group-hover:scale-110 transition-transform"
                />
              </div>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Connect dual live cameras across Bacolod and {partnerCity}. Snap synchronized 4-cut
                strips, co-decorate with stamps, and preserve your keepsake.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs font-medium text-foreground/80 border-t border-black/[0.05]">
              <span>Enter Booth</span>
              <ArrowUpRight
                size={14}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </div>
          </section>

          {/* ── Milestone Progress Card ── */}
          <section className="rounded-3xl border border-black/[0.06] bg-white/75 backdrop-blur-2xl p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                Monthly Milestone
              </span>
              <span className="text-[11px] font-mono tabular-nums text-foreground/70">
                19th of each month
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-base font-semibold text-foreground">
                  {daysToNextMonthsary === 0
                    ? "Today is our Monthsary"
                    : `${daysToNextMonthsary} days remaining`}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {cycleProgress}%
                </span>
              </div>

              {/* Minimalist Progress Line */}
              <div className="w-full h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
            </div>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.04]">
              <div className="text-center p-2 rounded-xl bg-black/[0.02]">
                <div className="font-serif text-base font-semibold text-foreground">
                  {stats?.memories ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                  Memories
                </div>
              </div>

              <div className="text-center p-2 rounded-xl bg-black/[0.02]">
                <div className="font-serif text-base font-semibold text-foreground">
                  {stats?.hugs ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                  Embraces
                </div>
              </div>

              <div className="text-center p-2 rounded-xl bg-black/[0.02]">
                <div className="font-serif text-base font-semibold text-foreground">
                  {stats?.trips ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                  Places
                </div>
              </div>
            </div>
          </section>

          {/* ── Editorial Calendar Spread ── */}
          <section className="rounded-3xl border border-black/[0.06] bg-white/75 backdrop-blur-2xl p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCursor(subMonths(cursor, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-95 transition-all text-foreground/80 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setTab("calendar")}
                className="font-serif text-base font-medium text-foreground tracking-tight hover:underline cursor-pointer"
              >
                {format(cursor, "MMMM yyyy")}
              </button>
              <button
                onClick={() => setCursor(addMonths(cursor, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-95 transition-all text-foreground/80 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-wider text-muted-foreground font-medium">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`b${i}`} />
              ))}
              {gridDays.map((d) => {
                const hasEvent = monthEvents.some((e) => isSameDay(new Date(e.starts_at), d));
                const dayPhoto = monthPhotos.find(
                  (p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d),
                );
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    className={`relative aspect-square flex items-center justify-center rounded-full overflow-hidden transition-colors ${
                      isToday ? "ring-1.5 ring-foreground font-semibold" : "hover:bg-black/[0.04]"
                    } ${!isSameMonth(d, cursor) ? "opacity-25" : ""}`}
                  >
                    {dayPhoto?.url && (
                      <>
                        <img
                          src={dayPhoto.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-white/20 border border-white/40 rounded-full" />
                      </>
                    )}
                    <span
                      className={`relative z-10 text-[11px] tabular-nums ${
                        isToday
                          ? "text-foreground font-bold"
                          : dayPhoto
                            ? "text-foreground font-medium"
                            : "text-foreground/80"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {hasEvent && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-rose-500 z-10" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Our Sanctuary"
        description="Welcome to your private shared space. Here, distance dissolves into synchronous moments, shared memories, live photo strips, and continuous connection. Tap into our story anytime."
      />

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
