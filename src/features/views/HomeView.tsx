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
  MapPin,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Gift,
  Star,
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
} from "@/lib/location-service";
import {
  WashiTape,
  LoopedHeartRibbon,
  PeekingCat,
  CuteBoyAvatar,
  CuteGirlAvatar,
  LilyBouquetAccent,
} from "@/components/kawaii/KawaiiIllustrations";

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
    ? (rel.user_a_id === user?.id ? rel.name_b : rel.name_a) || "Aya"
    : "Aya";

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
      partnerCityProfile.lng
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
      nowDate
    );
  }, [userCityProfile.timezone, partnerCityProfile.timezone, nowDate]);

  const userSolar = useMemo(() => getSolarState(localTime.hour24), [localTime.hour24]);
  const partnerSolar = useMemo(() => getSolarState(partnerTime.hour24), [partnerTime.hour24]);

  const { data: recentAction, isLoading: loadingAction } = useQuery({
    queryKey: ["recent-partner-action", relationshipId, user?.id],
    enabled: !!user && !!relationshipId,
    queryFn: async () => {
      const { data: r } = await supabase
        .from("relationships")
        .select("*")
        .eq("id", relationshipId)
        .single();
      if (!r) return null;
      const partnerId = r.user_a_id === user!.id ? r.user_b_id : r.user_a_id;
      if (!partnerId) return null;

      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", partnerId)
        .maybeSingle();
      const pName = r.user_a_id === user!.id ? r.name_b : r.name_a;

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
            text: "pinned a note",
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
        text = "shared a song";
      } else if (latestNotif.kind === "hug") {
        const { data } = await supabase
          .from("hugs")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "sent a warm hug";
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
      const sDateStart = format(startOfMonth(cursor), "yyyy-MM-dd");
      const sDateEnd = format(endOfMonth(cursor), "yyyy-MM-dd");
      const sStart = startOfMonth(cursor).toISOString();
      const sEnd = endOfMonth(cursor).toISOString();

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
        (now.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24)
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
      toast.success(`A warm hug sent to ${partnerName} ♡`);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <div className="relative mx-auto max-w-md md:max-w-4xl lg:max-w-6xl px-3 sm:px-6 py-4 pb-32">
      {/* ── 3rd Monthsary Special Story Banner ── */}
      {isMonthsary && (
        <section
          onClick={openMonthsary}
          className="mb-6 cursor-pointer relative overflow-hidden rounded-3xl border-2 border-pink-200/80 bg-gradient-to-r from-pink-100/90 via-white/90 to-sky-100/80 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_25px_rgba(251,207,232,0.45)] hover:border-pink-300 transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-serif text-base sm:text-lg font-medium text-[#233554] flex items-center gap-2">
                <span>Happy Monthsary, {partnerName}!</span>
                <span className="text-pink-500">♡</span>
              </div>
              <p className="text-xs text-sky-900/70 font-light">
                Our milestone memory story is ready. Tap to open our little chapter.
              </p>
            </div>
            <span className="text-xs font-medium text-pink-700 bg-white/90 px-4 py-1.5 rounded-full border border-pink-200 shadow-xs group-hover:bg-pink-50 transition-colors">
              Open Story ♡
            </span>
          </div>
        </section>
      )}

      {/* ── Responsive 2-Column Spread (Matching Reference Image) ── */}
      <div className="md:grid md:grid-cols-12 md:gap-6 space-y-6 md:space-y-0 items-start">
        {/* Left Column (Col 7 on Desktop) */}
        <div className="space-y-6 md:col-span-7">
          {/* ── CARD 1: SYNCHRONOUS SPACE ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)] space-y-4">
            {/* Header: Live sync pulse & Distance badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] font-bold text-[#334e68]">
                  Synchronous Space
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-[#334e68] px-3 py-1 rounded-full border border-sky-200/80 bg-sky-50/70 shadow-2xs">
                  <span>{distanceKm} km apart</span>
                </div>
                <button
                  onClick={() => setShowCityPicker((v) => !v)}
                  className="text-[11px] text-sky-600 hover:text-sky-800 bg-white/80 px-2.5 py-1 rounded-full border border-sky-100 shadow-2xs transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* In-place City Configuration Accordion */}
            {showCityPicker && (
              <div className="p-3.5 rounded-2xl border border-sky-200 bg-sky-50/50 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#233554]">
                  <span>Update Partner City</span>
                  <button
                    onClick={() => setShowCityPicker(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPartnerCity}
                    onChange={(e) => setTempPartnerCity(e.target.value)}
                    placeholder="Enter city (e.g. Manila, Tokyo, Cebu)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-sky-200 bg-white text-xs outline-none focus:ring-1 focus:ring-pink-300"
                  />
                  <button
                    onClick={() => {
                      const c = tempPartnerCity.trim() || "Manila";
                      setPartnerCity(c);
                      setPartnerCityLocal(c);
                      setShowCityPicker(false);
                      toast.success(`Partner city set to ${c} ♡`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-xs font-medium hover:bg-pink-600 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Check size={12} />
                    Apply
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["Manila", "Tokyo", "Cebu City", "Iloilo City", "Davao City", "Baguio", "Dumaguete", "Vancouver"].map(
                    (c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setPartnerCity(c);
                          setPartnerCityLocal(c);
                          setTempPartnerCity(c);
                          setShowCityPicker(false);
                          toast.success(`Partner city updated to ${c} ♡`);
                        }}
                        className="text-[10px] px-2.5 py-0.5 rounded-full border border-sky-200/70 bg-white/80 hover:bg-white text-slate-700 transition-colors cursor-pointer"
                      >
                        {c}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Dual Profile & Looped Heart Ribbons (Matches reference image) */}
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-sky-50/50 via-white/80 to-pink-50/30 border border-sky-100/80">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                {/* Sean Side (Left) */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <CuteBoyAvatar />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold block">
                      Sean
                    </span>
                    <div className="flex items-center gap-1 font-serif text-sm sm:text-base font-semibold text-[#233554] truncate">
                      <MapPin size={12} className="text-sky-500 shrink-0" />
                      <span>{userCity}</span>
                    </div>
                    <div className="font-serif text-base sm:text-lg font-bold text-[#1e293b] tabular-nums mt-0.5">
                      {localTime.timeStr}
                    </div>
                    <div className="text-[10px] text-sky-800/70 font-light truncate">
                      {userSolar.phase} · {userSolar.mood}
                    </div>
                  </div>
                </div>

                {/* Looped Heart Ribbon Transit (Center) */}
                <div className="flex-1 flex flex-col items-center justify-center px-1 sm:px-3">
                  <span className="font-serif italic text-xs text-pink-400 font-medium mb-0.5">
                    to
                  </span>
                  <LoopedHeartRibbon />
                </div>

                {/* Partner Side (Right) */}
                <div className="flex items-center gap-2.5 min-w-0 text-right justify-end">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold block">
                      Partner
                    </span>
                    <div className="flex items-center justify-end gap-1 font-serif text-sm sm:text-base font-semibold text-[#233554] truncate">
                      <MapPin size={12} className="text-pink-500 shrink-0" />
                      <span>{partnerCity}</span>
                    </div>
                    <div className="font-serif text-base sm:text-lg font-bold text-[#1e293b] tabular-nums mt-0.5">
                      {partnerTime.timeStr}
                    </div>
                    <div className="text-[10px] text-pink-900/70 font-light truncate">
                      {partnerSolar.phase} · {partnerSolar.mood}
                    </div>
                  </div>
                  <CuteGirlAvatar />
                </div>
              </div>
            </div>

            {/* Inset Timezone & Coordinate Capsule */}
            <div className="rounded-full bg-sky-50/80 border border-sky-100 py-1.5 px-4 text-center text-[11px] text-slate-600 flex items-center justify-center gap-2 shadow-inner">
              <Clock size={12} className="text-pink-400" />
              <span className="font-medium text-[#233554]">{tzDifference}</span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] text-slate-500">
                Coordinates: {userCityProfile.lat.toFixed(1)}°N · {partnerCityProfile.lat.toFixed(1)}°N
              </span>
              <Sparkles size={11} className="text-amber-400" />
            </div>

            {/* 3 Tactile Action Buttons (Send Hug, Leave Note, Add Memory) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([40, 80, 40]);
                  }
                  hug.mutate();
                }}
                disabled={hug.isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 rounded-full border border-pink-200/90 bg-pink-100/90 hover:bg-pink-200/90 text-pink-700 active:scale-95 transition-all cursor-pointer font-medium text-xs shadow-xs"
              >
                <Heart size={14} className="fill-pink-400 text-pink-500 shrink-0" />
                <span>Send Hug</span>
              </button>

              <button
                onClick={() => openSheet("add-note")}
                className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 rounded-full border border-sky-100 bg-white/95 hover:bg-white text-slate-700 active:scale-95 transition-all cursor-pointer font-medium text-xs shadow-xs"
              >
                <PenSquare size={14} className="text-slate-500 shrink-0" />
                <span>Leave Note</span>
              </button>

              <button
                onClick={() => openSheet("add-memory")}
                className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 rounded-full border border-sky-200/70 bg-sky-50/90 hover:bg-sky-100 text-sky-800 active:scale-95 transition-all cursor-pointer font-medium text-xs shadow-xs"
              >
                <Plus size={14} className="text-sky-600 shrink-0" />
                <span>Add Memory</span>
              </button>
            </div>
          </section>

          {/* ── CARD 2: WELCOME / TOGETHER & PARTNER CHRONICLE (Split Card) ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-sky-100/80">
              {/* Left Side: Intimate Greeting & Milestone Ticker */}
              <div
                {...longPressProps}
                className="p-5 sm:p-6 flex flex-col justify-between relative cursor-pointer hover:bg-sky-50/30 transition-colors"
                title="Hold to view space guide"
              >
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                    Home
                  </div>
                  <div className="font-serif text-2xl font-normal text-[#233554] tracking-tight">
                    Welcome back, {name}. <span className="text-pink-400 font-normal">♡</span>
                  </div>
                </div>

                {timeTogether && (
                  <div className="mt-5 pt-4 border-t border-sky-100/80 space-y-1">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold block">
                      Together
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-3xl sm:text-4xl font-bold text-[#1e293b] tracking-tight">
                        {timeTogether.totalDays}
                      </span>
                      <span className="font-serif italic text-base text-pink-500 font-normal">
                        days of devotion ♡
                      </span>
                    </div>
                    <div className="font-mono text-xs tabular-nums text-slate-500 tracking-wider">
                      {String(timeTogether.hours).padStart(2, "0")}h{" "}
                      {String(timeTogether.mins).padStart(2, "0")}m{" "}
                      {String(timeTogether.secs).padStart(2, "0")}s
                    </div>
                  </div>
                )}

                {/* Subtle Lily accent in corner */}
                <div className="absolute -bottom-2 -left-2 opacity-25 pointer-events-none">
                  <img src="/lily2.png" alt="" className="w-16 h-16 object-contain" />
                </div>
              </div>

              {/* Right Side: Partner Chronicle with Tactile Polaroid & Washi Tape */}
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
                className="p-5 sm:p-6 flex flex-col justify-between cursor-pointer hover:bg-sky-50/30 transition-colors group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                    Partner Chronicle
                  </span>
                  <ArrowRight size={14} className="text-sky-400 group-hover:translate-x-1 transition-transform" />
                </div>

                {/* Tactile Polaroid Card with Washi Tape */}
                <div className="my-3 flex flex-col items-center">
                  <div className="relative p-2.5 pb-3 bg-white rounded-xl shadow-[0_6px_20px_rgba(186,215,255,0.45)] border border-slate-100 max-w-[210px] w-full transform -rotate-1 group-hover:rotate-0 transition-transform">
                    {/* Cute Washi Tape Strip */}
                    <WashiTape color="pink" pattern="gingham" />

                    {/* Polaroid Photo Window */}
                    <div className="w-full h-24 sm:h-28 rounded-lg overflow-hidden bg-gradient-to-br from-sky-200 via-pink-100 to-amber-100 flex items-center justify-center relative shadow-inner">
                      {recentAction?.item?.cover_url || recentAction?.item?.image_url ? (
                        <img
                          src={recentAction.item.cover_url || recentAction.item.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <Heart size={20} className="text-pink-400 fill-pink-200 mx-auto mb-1 animate-pulse" />
                          <span className="font-serif italic text-[11px] text-slate-600 block">
                            Our Sky Together
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Polaroid Caption */}
                    <div className="mt-2 text-center">
                      <p className="text-[10px] sm:text-[11px] text-slate-600 font-serif italic line-clamp-2 px-1">
                        "{recentAction?.item?.body || "No moments shared yet today. Leave a note or send a hug."}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Synchronize Button */}
                <div className="flex items-center justify-center pt-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-[10px] font-medium border border-sky-100 shadow-2xs group-hover:bg-sky-100 transition-colors">
                    <RefreshCw size={10} className="text-sky-500" />
                    <span>Synchronize</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── CARD 3: UPCOMING MOMENTS ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <CalendarIcon size={14} className="text-pink-400" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                  Upcoming Moments
                </span>
              </div>
              <button
                onClick={() => setTab("calendar")}
                className="text-xs font-medium text-sky-600 hover:text-sky-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Calendar</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-50/60 via-white to-sky-50/40 border border-pink-100/70">
              {/* Left Date Stamp Badge */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-pink-200 shadow-xs flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-pink-600">
                    {stats?.nextEvent
                      ? format(new Date(stats.nextEvent.starts_at), "MMM")
                      : "NOV"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <span className="font-serif text-lg font-bold text-[#233554] leading-none">
                      {stats?.nextEvent
                        ? format(new Date(stats.nextEvent.starts_at), "d")
                        : "19"}
                    </span>
                    <span className="text-pink-400 text-xs">♡</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-serif text-base font-semibold text-[#233554] flex items-center gap-1.5">
                    <span>{stats?.nextEvent?.title || "Our 5th monthsary"}</span>
                    <span className="text-pink-400">♡</span>
                  </h4>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    {stats?.nextEvent
                      ? format(new Date(stats.nextEvent.starts_at), "EEEE, MMMM d · h:mm a")
                      : `Together for ${timeTogether?.totalDays || 146} days!`}
                  </p>
                </div>
              </div>

              {/* Bouquet decoration in corner */}
              <LilyBouquetAccent className="hidden sm:block absolute right-2 -bottom-2" />
            </div>

            {/* Schedule trigger capsule */}
            <button
              onClick={() => openSheet("add-event")}
              className="mt-3 w-full py-2.5 rounded-full border border-dashed border-sky-300/80 bg-sky-50/40 hover:bg-sky-50 text-sky-700 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={13} className="text-sky-500" />
              <span>Schedule a shared date or call</span>
            </button>
          </section>
        </div>

        {/* Right Column (Col 5 on Desktop) */}
        <div className="space-y-6 md:col-span-5">
          {/* ── CARD 4: STUDIO (Remote LDR Photo Booth) ── */}
          <section
            onClick={() => setTab("photobooth")}
            className="cursor-pointer relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)] hover:shadow-lg transition-all active:scale-[0.99] group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Star size={13} className="text-amber-400 fill-amber-300" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                  Studio
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Synchronized</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Tactile Polaroid Keepsake with Washi Tape */}
              <div className="relative p-2 pb-2.5 bg-white rounded-xl shadow-[0_4px_14px_rgba(186,215,255,0.5)] border border-slate-100 w-24 shrink-0 transform -rotate-3 group-hover:rotate-0 transition-transform">
                <WashiTape color="blue" pattern="gingham" />
                <div className="w-full h-20 rounded-lg overflow-hidden bg-gradient-to-b from-sky-300 via-sky-200 to-indigo-100 flex items-center justify-center shadow-inner">
                  <div className="w-9 h-9 rounded-full border border-white/80 flex items-center justify-center text-white">
                    <Heart size={16} className="fill-white/80" />
                  </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-serif text-base font-semibold text-[#233554] tracking-tight truncate">
                    Remote LDR Photo Booth
                  </h3>
                  <Camera size={14} className="text-pink-500 shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 font-light leading-relaxed line-clamp-3">
                  Connect dual live cameras across Bacolod and {partnerCity}. Snap synchronized 4-cut strips, co-decorate with stamps, and preserve your keepsake.
                </p>
                <div className="pt-1 flex items-center gap-1 text-xs font-medium text-sky-700 group-hover:text-pink-600 transition-colors">
                  <span>Enter Booth</span>
                  <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </section>

          {/* ── CARD 5: MONTHLY MILESTONE ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                Monthly Milestone
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                19th of each month
              </span>
            </div>

            <div className="relative pt-6">
              {/* Adorable Peeking Cat on the Progress Bar */}
              <div
                className="absolute -top-3.5 transition-all duration-700 ease-out"
                style={{
                  left: `clamp(10%, ${cycleProgress}%, 85%)`,
                  transform: "translateX(-50%)",
                }}
              >
                <PeekingCat />
              </div>

              {/* Header inside: Days remaining & percent */}
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-serif text-lg font-bold text-[#233554] flex items-center gap-1.5">
                  <span>
                    {daysToNextMonthsary === 0
                      ? "Happy Monthsary Day!"
                      : `${daysToNextMonthsary} days remaining`}
                  </span>
                  <span className="text-pink-400">♡</span>
                </span>
                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                  {cycleProgress}%
                </span>
              </div>

              {/* Soft Pillowy Progress Bar */}
              <div className="w-full h-3 rounded-full bg-pink-100/70 overflow-hidden shadow-inner p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-pink-300 via-rose-400 to-pink-500 rounded-full transition-all duration-700 ease-out shadow-xs"
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
            </div>

            {/* 3 Soft Inset Metric Pills */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center p-2 rounded-2xl bg-sky-50/60 border border-sky-100 shadow-2xs">
                <Heart size={14} className="text-pink-400 fill-pink-200 mx-auto mb-0.5" />
                <div className="font-serif text-base font-bold text-[#233554]">
                  {stats?.memories ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">
                  Memories
                </div>
              </div>

              <div className="text-center p-2 rounded-2xl bg-pink-50/60 border border-pink-100 shadow-2xs">
                <Star size={14} className="text-amber-400 fill-amber-200 mx-auto mb-0.5" />
                <div className="font-serif text-base font-bold text-[#233554]">
                  {stats?.hugs ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">
                  Embraces
                </div>
              </div>

              <div className="text-center p-2 rounded-2xl bg-indigo-50/60 border border-indigo-100 shadow-2xs">
                <Gift size={14} className="text-indigo-400 fill-indigo-200 mx-auto mb-0.5" />
                <div className="font-serif text-base font-bold text-[#233554]">
                  {stats?.trips ?? 0}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">
                  Places
                </div>
              </div>
            </div>
          </section>

          {/* ── CARD 6: CALENDAR (Pastel Planner Aesthetic) ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/85 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_12px_36px_-6px_rgba(186,215,255,0.4),0_4px_16px_rgba(224,242,254,0.5)] space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCursor(subMonths(cursor, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-100 active:scale-95 transition-all text-slate-600 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setTab("calendar")}
                className="font-serif text-base font-semibold text-[#233554] tracking-tight hover:text-pink-600 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{format(cursor, "MMMM yyyy")}</span>
                <span className="text-pink-400 font-normal">♡</span>
              </button>
              <button
                onClick={() => setCursor(addMonths(cursor, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sky-100 active:scale-95 transition-all text-slate-600 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-wider text-slate-400 font-bold uppercase">
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
                  (p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d)
                );
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    className={`relative aspect-square flex items-center justify-center rounded-2xl overflow-hidden transition-all ${
                      isToday
                        ? "bg-gradient-to-tr from-pink-200 to-rose-200 text-rose-900 font-bold shadow-[0_2px_10px_rgba(244,114,182,0.4)] border border-pink-300"
                        : "hover:bg-sky-50 text-slate-700"
                    } ${!isSameMonth(d, cursor) ? "opacity-25" : ""}`}
                  >
                    {dayPhoto?.url && (
                      <>
                        <img
                          src={dayPhoto.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-white/20 border border-white/40 rounded-2xl" />
                      </>
                    )}
                    <span
                      className={`relative z-10 text-[11px] tabular-nums ${
                        isToday
                          ? "text-rose-950 font-bold"
                          : dayPhoto
                          ? "text-slate-900 font-bold"
                          : "text-slate-700"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {hasEvent && (
                      <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-pink-500 z-10 shadow-xs" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Corner lily accent */}
            <div className="absolute -bottom-3 -right-3 opacity-20 pointer-events-none">
              <img src="/main-lily.png" alt="" className="w-20 h-20 object-contain" />
            </div>
          </section>
        </div>
      </div>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Our Sanctuary ♡"
        description="Welcome to your private shared space. Here, distance dissolves into synchronous moments, shared memories, live photo strips, and continuous connection. Tap into our story anytime."
      />

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
