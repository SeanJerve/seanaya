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
  SquarePen,
  Clock,
  MapPin,
  ArrowRight,
  RefreshCw,
  Gift,
  Star,
  X,
  Check,
  Home as HomeIcon,
  Route,
  Trophy,
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
  ART,
  Bow,
  ChibiTile,
  HeartRibbon,
  Polaroid,
  Sparkle,
  TodayHeart,
} from "@/components/seanaya/art";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Small outlined heart used as a quiet accent beside headings. */
function HeartMark({ className = "", size = 20 }: { className?: string; size?: number }) {
  return <Heart size={size} strokeWidth={1.5} aria-hidden className={`shrink-0 ${className}`} />;
}

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

  const meIsAya = name.trim().toLowerCase() === "aya";
  const myChibi = meIsAya ? ART.ayaChibi : ART.seanChibi;
  const partnerChibi = meIsAya ? ART.seanChibi : ART.ayaChibi;

  // When nothing is scheduled, the next monthsary is the upcoming moment.
  const monthsaryNumber = Math.max(
    1,
    (nextMonthsaryDate.getFullYear() - start.getFullYear()) * 12 +
      (nextMonthsaryDate.getMonth() - start.getMonth()),
  );
  const upcoming = stats?.nextEvent
    ? {
        date: new Date(stats.nextEvent.starts_at),
        title: stats.nextEvent.title as string,
        detail: format(new Date(stats.nextEvent.starts_at), "EEEE, MMMM d · h:mm a"),
      }
    : {
        date: nextMonthsaryDate,
        title: `Our ${ordinal(monthsaryNumber)} monthsary`,
        detail: `Together for ${Math.max(0, differenceInDays(nextMonthsaryDate, start))} days`,
      };

  const chroniclePhoto =
    recentAction?.item?.cover_url || recentAction?.item?.image_url || ART.polaroidDusk;
  const trailingCells = (7 - ((leading + gridDays.length) % 7)) % 7;

  const openChronicle = () => {
    if (!recentAction) return;
    if (recentAction.kind === "wall" || recentAction.kind === "note") setTab("wall");
    else if (recentAction.kind === "memory") setTab("memories");
    else if (recentAction.kind === "event") setTab("calendar");
  };

  return (
    <div className="relative mx-auto w-full max-w-[640px] px-4 pb-32 pt-5 sm:px-6 lg:max-w-[1186px] lg:pt-4 xl:mx-0 xl:max-w-none xl:pl-[22px] xl:pr-9">
      {isMonthsary && (
        <button
          onClick={openMonthsary}
          className="sn-card mb-[18px] flex w-full items-center justify-between gap-4 p-5 text-left sm:px-7"
        >
          <div>
            <div className="font-serif text-[22px] font-semibold text-sn-navy">
              Happy monthsary, {partnerName}
            </div>
            <p className="mt-0.5 text-[14px] text-sn-muted">
              This month's little story is ready for you.
            </p>
          </div>
          <span className="sn-pill h-10 shrink-0 px-5 text-[14px] font-semibold text-sn-rose">
            Open story
          </span>
        </button>
      )}

      <div className="grid items-stretch gap-[18px] lg:grid-cols-[minmax(0,1.225fr)_minmax(0,1fr)]">
        {/* ───────── Left column ───────── */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* Synchronous space — a postcard between two places */}
          <section className="sn-card @container px-5 pb-5 pt-5 sm:px-6 sm:pb-[16px] sm:pt-[15px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inset-0 rounded-full bg-sn-mint motion-safe:animate-[sn-breathe_2.4s_ease-in-out_infinite]" />
                  <span className="relative h-3 w-3 rounded-full border-2 border-white bg-sn-mint" />
                </span>
                <h2 className="sn-label whitespace-nowrap">Synchronous space</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="sn-pill h-9 cursor-default whitespace-nowrap px-3 text-[13.5px] tabular-nums text-sn-ink hover:shadow-[var(--shadow-pill)] sm:px-3.5">
                  <Route size={16} strokeWidth={1.7} className="text-[#5b6aa6]" />
                  <span>
                    {distanceKm} km<span className="hidden sm:inline"> apart</span>
                  </span>
                </span>
                <button
                  onClick={() => setShowCityPicker((v) => !v)}
                  aria-expanded={showCityPicker}
                  className="sn-pill h-9 px-3 text-[13.5px] text-sn-ink sm:px-4"
                >
                  Edit
                </button>
              </div>
            </div>

            {showCityPicker && (
              <div className="mt-4 rounded-[20px] border border-white bg-white/60 p-4 shadow-[var(--shadow-press)]">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-[17px] font-semibold text-sn-navy">
                    Where is {partnerName} today?
                  </span>
                  <button
                    onClick={() => setShowCityPicker(false)}
                    aria-label="Close"
                    className="grid h-8 w-8 place-items-center rounded-full text-sn-muted hover:bg-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={tempPartnerCity}
                    onChange={(e) => setTempPartnerCity(e.target.value)}
                    placeholder="City, e.g. Tokyo"
                    className="h-10 min-w-0 flex-1 rounded-full border border-[#dfe3f6] bg-white px-4 text-[14px] text-sn-navy outline-none placeholder:text-sn-faint focus:border-sn-periwinkle"
                  />
                  <button
                    onClick={() => {
                      const c = tempPartnerCity.trim() || "Manila";
                      setPartnerCity(c);
                      setPartnerCityLocal(c);
                      setShowCityPicker(false);
                      toast.success(`Partner city set to ${c} ♡`);
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-full bg-sn-navy px-4 text-[14px] font-semibold text-white active:scale-95"
                  >
                    <Check size={15} />
                    Apply
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
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
                        className="rounded-full px-3 py-1 text-[13px] text-sn-ink hover:bg-white"
                      >
                        {c}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Two people, two clocks */}
            <div className="relative mt-5 grid grid-cols-2 gap-4 @min-[570px]:-mx-2 @min-[570px]:mt-[14px] @min-[570px]:flex @min-[570px]:items-center @min-[570px]:justify-between">
              <Person
                side="left"
                label={name}
                city={userCity}
                time={localTime.timeStr}
                detail={`${userSolar.phase} · ${userSolar.mood}`}
                portrait={myChibi}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[22px] flex w-[30%] -translate-x-1/2 flex-col items-center @min-[570px]:top-[4px] @min-[570px]:w-[27%]"
              >
                <HeartRibbon className="w-full" />
                <span className="-mt-0.5 font-serif text-[18px] italic text-[#6f7fbd]">to</span>
                <span className="mt-1 hidden h-10 w-px bg-gradient-to-b from-[#d9dcf1] to-transparent @min-[570px]:block" />
              </div>
              <Person
                side="right"
                label="Partner"
                city={partnerCity}
                time={partnerTime.timeStr}
                detail={`${partnerSolar.phase} · ${partnerSolar.mood}`}
                portrait={partnerChibi}
              />
            </div>

            <div className="relative mx-auto mt-5 flex w-full max-w-[470px] @min-[570px]:mt-[18px] items-center justify-center">
              <HeartMark size={18} className="absolute -left-12 hidden text-[#f19cbd] @min-[570px]:block" />
              <div className="flex min-h-[32px] w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 rounded-full bg-[linear-gradient(90deg,rgba(251,226,236,0.55),#fbe2ec_20%,#fbe2ec_80%,rgba(251,226,236,0.55))] px-5 py-1.5 text-[13.5px] text-sn-ink">
                <span className="flex items-center gap-2">
                  <Clock size={16} strokeWidth={1.7} className="text-[#e7709e]" />
                  {tzDifference}
                </span>
                <span className="text-sn-faint">·</span>
                <span className="tabular-nums">
                  Coordinates: {userCityProfile.lat.toFixed(1)}°N · {partnerCityProfile.lat.toFixed(1)}°N
                </span>
              </div>
              <HeartMark size={18} className="absolute -right-12 hidden text-[#f19cbd] @min-[570px]:block" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-4 @min-[570px]:mt-[15px]">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([40, 80, 40]);
                  }
                  hug.mutate();
                }}
                disabled={hug.isPending}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] bg-[linear-gradient(180deg,#fde4ee,#f8cddd)] px-2 text-[13px] font-semibold text-[#c23c71] sm:h-[46px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <Heart size={19} strokeWidth={1.8} className="shrink-0 text-[#d9467f]" />
                Send Hug
              </button>
              <button
                onClick={() => openSheet("add-note")}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] px-2 text-[13px] font-medium sm:h-[46px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <SquarePen size={18} strokeWidth={1.7} className="shrink-0 text-[#5b6aa6]" />
                Leave Note
              </button>
              <button
                onClick={() => openSheet("add-memory")}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] px-2 text-[13px] font-medium sm:h-[46px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <Plus size={19} strokeWidth={1.7} className="shrink-0 text-[#5b6aa6]" />
                Add Memory
              </button>
            </div>
          </section>

          {/* Together + partner chronicle */}
          <section className="sn-card grid overflow-hidden sm:grid-cols-[0.9fr_1fr]">
            <div
              {...longPressProps}
              title="Hold for a little guide"
              className="relative flex flex-col overflow-hidden px-6 pb-6 pt-6 sm:pl-[34px] sm:pr-5 sm:pt-[24px]"
            >
              <div className="flex items-center gap-2.5">
                <HomeIcon size={22} strokeWidth={1.6} className="text-[#5468b0]" />
                <h2 className="sn-label">Home</h2>
              </div>
              <p className="mt-4 font-serif text-[32px] font-semibold leading-[1.12] tracking-[-0.01em] text-sn-navy sm:text-[35px]">
                Welcome back,
                <br />
                <span className="inline-flex items-center gap-3">
                  {name}.
                  <Heart
                    strokeWidth={1.5}
                    className="h-7 w-7 fill-[#cdd7f7] text-[#6f86d6]"
                    aria-hidden
                  />
                </span>
              </p>
              <div className="mt-4 h-px w-full bg-gradient-to-r from-[#e3e5f5] via-[#e3e5f5] to-transparent" />
              {timeTogether && (
                <div className="relative z-10 mt-4">
                  <h3 className="sn-label text-[12.5px]">Together</h3>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5">
                    <span className="font-serif text-[50px] font-bold leading-none tracking-[-0.02em] text-sn-navy tabular-nums">
                      {timeTogether.totalDays}
                    </span>
                    <span className="flex items-center gap-2 font-serif text-[21px] italic text-sn-ink">
                      days of devotion
                      <HeartMark size={22} className="text-[#7a87bd]" />
                    </span>
                  </div>
                  <div className="mt-2.5 text-[16px] font-semibold tracking-[0.03em] text-sn-ink tabular-nums">
                    {String(timeTogether.hours).padStart(2, "0")}h{" "}
                    {String(timeTogether.mins).padStart(2, "0")}m{" "}
                    {String(timeTogether.secs).padStart(2, "0")}s
                  </div>
                </div>
              )}
              <img
                src={ART.lilyOpen}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -bottom-12 -right-8 w-[150px] rotate-[-28deg] select-none"
              />
            </div>

            <div
              onClick={openChronicle}
              className={`relative flex flex-col border-t border-[#ebe8f6] px-6 pb-5 pt-6 sm:border-l sm:border-t-0 sm:px-[24px] sm:pb-[10px] sm:pt-[24px] ${recentAction ? "cursor-pointer" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="sn-label">Partner chronicle</h2>
                <ArrowRight size={20} strokeWidth={1.7} className="text-[#4a5687]" />
              </div>
              <div className="relative mt-[18px] flex items-start pl-3">
                <Polaroid
                  src={chroniclePhoto}
                  alt={recentAction ? "Latest shared photo" : ""}
                  tape="pink"
                  tilt={-8}
                  className="w-[128px] sm:w-[134px]"
                  photoClassName="aspect-[116/94]"
                />
                <HeartMark size={22} className="ml-6 mt-6 text-[#f19cbd]" />
              </div>
              {recentAction && (
                <p className="mt-5 text-[13px] text-sn-muted">
                  {recentAction.partnerName} {recentAction.text} ·{" "}
                  {format(new Date(recentAction.createdAt), "MMM d, h:mm a")}
                </p>
              )}
              <p
                className={`${recentAction ? "mt-1.5" : "mt-4"} line-clamp-3 text-[15.5px] leading-[1.5] text-sn-navy`}
              >
                “{recentAction?.item?.body ||
                  recentAction?.item?.title ||
                  "No moments shared yet today. Leave a note or send a hug."}
                ”
              </p>
              <div className="mt-auto flex justify-center pt-5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
                    toast.success("Synced with your partner's latest");
                  }}
                  disabled={loadingAction}
                  className="sn-pill h-[42px] bg-[linear-gradient(180deg,#eef1fe,#dfe6fb)] px-8 text-[15px] font-medium"
                >
                  <RefreshCw
                    size={17}
                    strokeWidth={1.8}
                    className={`text-sn-navy ${loadingAction ? "animate-spin" : ""}`}
                  />
                  Synchronize
                </button>
              </div>
            </div>
          </section>

          {/* Upcoming moments — a planner note */}
          <section className="sn-card flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-7 sm:pb-[8px] sm:pt-[19px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarIcon size={21} strokeWidth={1.6} className="text-[#5468b0]" />
                <h2 className="sn-label">Upcoming moments</h2>
              </div>
              <button
                onClick={() => setTab("calendar")}
                className="flex items-center gap-1.5 text-[15px] text-sn-ink hover:text-sn-navy"
              >
                Calendar
                <ArrowRight size={18} strokeWidth={1.7} />
              </button>
            </div>

            <div className="relative mt-2 flex-1 overflow-hidden rounded-[22px] border border-white/80 bg-[linear-gradient(90deg,#fdeef4,#fbf2f7_55%,#f3f0fb)] px-4 pb-4 pt-4 sm:pb-[8px] sm:pt-[10px] sm:pr-[190px]">
              <div className="flex items-center gap-4">
                <div className="relative flex h-[64px] w-[84px] shrink-0 flex-col items-start justify-center rounded-[18px] pl-[17px] bg-[linear-gradient(180deg,#fde4ee,#f8d0df)] shadow-[0_8px_16px_-10px_rgba(201,69,122,0.55)]">
                  <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.04em] text-[#cf4c80]">
                    {format(upcoming.date, "MMM")}
                  </span>
                  <span className="mt-1 font-serif text-[27px] font-semibold leading-none text-[#c23c71]">
                    {format(upcoming.date, "d")}
                  </span>
                  <HeartMark size={16} className="absolute right-[13px] top-[32px] text-[#e7709e]" />
                </div>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-serif text-[20px] font-semibold leading-tight text-sn-navy sm:text-[21px]">
                    <span className="line-clamp-2">{upcoming.title}</span>
                    <HeartMark size={18} className="text-sn-navy" />
                  </h3>
                  <p className="mt-1 text-[14.5px] text-sn-ink">{upcoming.detail}</p>
                </div>
              </div>
              <button
                onClick={() => openSheet("add-event")}
                className="mt-3 flex h-[36px] w-full items-center sm:mt-[11px] sm:h-[37px] justify-center gap-2 rounded-full border border-dashed border-[#d8cbe0] bg-white/30 text-[14px] text-[#566091] transition-colors hover:bg-white/60"
              >
                <Plus size={16} strokeWidth={1.7} />
                Schedule a shared date or call
              </button>
              <img
                src={ART.bouquet}
                alt="A bouquet of white lilies"
                className="pointer-events-none absolute -bottom-4 right-0 hidden w-[184px] select-none sm:block"
              />
            </div>
          </section>
        </div>

        {/* ───────── Right column ───────── */}
        <div className="flex min-w-0 flex-col gap-[18px]">
          {/* Studio — the photo booth */}
          <section
            onClick={() => setTab("photobooth")}
            className="sn-card sn-card-lavender group cursor-pointer px-5 pb-5 pt-5 sm:px-[26px] sm:pb-[22px] sm:pt-[16px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star size={21} strokeWidth={1.5} className="fill-[#fbd59a] text-sn-honey" />
                <h2 className="sn-label">Studio</h2>
              </div>
              <span className="sn-pill h-[34px] cursor-default bg-[#f6f6fe] px-4 text-[14px] text-sn-ink hover:shadow-[var(--shadow-pill)]">
                <span className="h-2.5 w-2.5 rounded-full bg-sn-mint" />
                Synchronized
              </span>
            </div>
            <div className="relative mt-3 flex items-start gap-5">
              <Polaroid
                src={ART.polaroidSky}
                tape="blue"
                tilt={-6}
                className="ml-1 mt-2 w-[118px] shrink-0 group-hover:rotate-[-3deg] sm:w-[150px]"
                photoClassName="aspect-[128/138]"
              />
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-[21px] font-semibold leading-tight text-sn-navy sm:text-[23px]">
                    Remote LDR Photo Booth
                  </h3>
                  <span className="-mr-1 -mt-1 hidden h-[40px] w-[40px] shrink-0 place-items-center rounded-full border border-white bg-[#f6f6fe] text-sn-navy shadow-[var(--shadow-pill)] sm:grid">
                    <Camera size={20} strokeWidth={1.7} />
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-[1.6] text-[#5b6489] sm:text-[14.5px]">
                  Connect dual live cameras across {userCity} and {partnerCity}. Snap synchronized
                  4-cut strips, co-decorate with stamps, and preserve your keepsake.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 border-b border-[#9aa2c4] pb-1 text-[16px] font-semibold text-sn-navy">
                  Enter Booth
                  <ArrowRight
                    size={18}
                    strokeWidth={1.8}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </div>
              <Bow className="absolute -bottom-2 right-0 hidden h-10 w-12 text-[#a9b4e4] sm:block" />
              <Sparkle className="absolute -bottom-3 right-14 hidden h-4 w-4 text-[#b9c3ec] sm:block" />
            </div>
          </section>

          {/* Monthly milestone */}
          <section className="sn-card @container px-5 pb-5 pt-5 sm:px-[30px] sm:pb-[16px] sm:pt-[20px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Trophy size={21} strokeWidth={1.6} className="fill-[#f8d79e] text-[#e3a24f]" />
                <h2 className="sn-label">Monthly milestone</h2>
              </div>
              <span className="text-[14px] text-[#5b6489] sm:text-[15px]">19th of each month</span>
            </div>

            <div className="relative mt-4">
              <div className="flex items-end justify-between gap-3">
                <span className="flex items-center gap-3 font-serif text-[26px] font-semibold leading-none text-sn-navy @min-[440px]:text-[31px]">
                  {daysToNextMonthsary === 0
                    ? "Happy monthsary!"
                    : `${daysToNextMonthsary} ${daysToNextMonthsary === 1 ? "day" : "days"} remaining`}
                  <HeartMark size={24} className="hidden text-[#f19cbd] sm:block" />
                </span>
                <span className="text-[20px] font-semibold leading-none text-[#e0609a] tabular-nums sm:text-[22px]">
                  {cycleProgress}%
                </span>
              </div>

              <div className="relative mt-3">
                <img
                  src={ART.catPeek}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute bottom-[12px] right-[52px] hidden w-[100px] select-none @min-[340px]:block @min-[440px]:right-[56px] @min-[440px]:w-[124px]"
                />
                <div
                  className="relative h-[18px] rounded-full border border-white bg-[#f6eef6] shadow-[inset_0_1px_3px_rgba(120,128,190,0.15)]"
                  role="progressbar"
                  aria-valuenow={cycleProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress to next monthsary"
                >
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#f8b9d4,#f38ab6)] transition-[width] duration-700"
                    style={{ width: `${cycleProgress}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${cycleProgress}%` }}
                  >
                    <TodayHeart className="h-full w-full drop-shadow-[0_2px_3px_rgba(201,69,122,0.35)]" />
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-[30px] grid grid-cols-3 gap-3 sm:gap-4">
              {[
                {
                  label: "Memories",
                  value: stats?.memories ?? 0,
                  icon: <Heart size={19} strokeWidth={1.5} className="fill-[#f48fbc] text-[#e8639b]" />,
                },
                {
                  label: "Embraces",
                  value: stats?.hugs ?? 0,
                  icon: <Star size={19} strokeWidth={1.6} className="text-[#5b6aa6]" />,
                },
                {
                  label: "Places",
                  value: stats?.trips ?? 0,
                  icon: <Gift size={19} strokeWidth={1.6} className="text-[#9a6fc8]" />,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex h-[70px] flex-col items-center justify-center rounded-[34px] border border-white/95 bg-[linear-gradient(180deg,#fbf8ff,#f2f0fb)] shadow-[var(--shadow-pill)]"
                >
                  {s.icon}
                  <span className="mt-1 font-serif text-[18px] font-semibold leading-none text-sn-navy tabular-nums">
                    {loadingStats ? "–" : s.value}
                  </span>
                  <span className="mt-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-sn-ink">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Planner calendar */}
          <section className="sn-card relative flex-1 px-4 pb-4 pt-4 sm:px-[26px] sm:pb-[10px] sm:pt-[13px]">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCursor(subMonths(cursor, 1))}
                className="grid h-[42px] w-[42px] place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-navy shadow-[var(--shadow-pill)] active:scale-95"
                aria-label="Previous month"
              >
                <ChevronLeft size={20} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setTab("calendar")}
                className="flex items-center gap-3 font-serif text-[24px] font-semibold text-sn-navy hover:text-[#33438a] sm:text-[26px]"
              >
                {format(cursor, "MMMM yyyy")}
                <HeartMark size={22} className="text-[#f19cbd]" />
              </button>
              <button
                onClick={() => setCursor(addMonths(cursor, 1))}
                className="grid h-[42px] w-[42px] place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-navy shadow-[var(--shadow-pill)] active:scale-95"
                aria-label="Next month"
              >
                <ChevronRight size={20} strokeWidth={1.8} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[14px] font-semibold text-sn-ink">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="pb-2.5">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center">
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`b${i}`} className="h-[42px] border-t border-l border-[#ebe8f6] first:border-l-0" />
              ))}
              {gridDays.map((d, idx) => {
                const hasEvent = monthEvents.some((e) => isSameDay(new Date(e.starts_at), d));
                const dayPhoto = monthPhotos.find(
                  (p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d),
                );
                const isToday = isSameDay(d, today);
                const col = (leading + idx) % 7;
                return (
                  <div
                    key={d.toISOString()}
                    title={dayPhoto?.title || undefined}
                    className={`relative flex h-[42px] items-center justify-center border-t border-[#ebe8f6] ${col === 0 ? "" : "border-l"} ${!isSameMonth(d, cursor) ? "opacity-30" : ""}`}
                  >
                    {isToday && (
                      <>
                        <TodayHeart className="absolute left-1/2 top-1/2 h-[50px] w-[50px] -translate-x-1/2 -translate-y-[46%] drop-shadow-[0_4px_8px_rgba(236,122,164,0.35)]" />
                        <HeartMark size={13} className="absolute bottom-[1px] right-[10%] fill-white text-[#e7709e]" />
                      </>
                    )}
                    <span
                      className={`relative z-10 text-[15.5px] tabular-nums ${isToday ? "font-bold text-sn-navy" : "text-sn-navy/90"}`}
                    >
                      {d.getDate()}
                    </span>
                    {(hasEvent || dayPhoto) && !isToday && (
                      <span className="absolute bottom-[5px] left-1/2 flex -translate-x-1/2 gap-[3px]">
                        {hasEvent && <span className="h-[5px] w-[5px] rounded-full bg-[#ec7aa4]" />}
                        {dayPhoto && <span className="h-[5px] w-[5px] rounded-full bg-[#8faaf0]" />}
                      </span>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: trailingCells }).map((_, i) => (
                <div key={`t${i}`} className="h-[42px] border-t border-l border-[#ebe8f6]" />
              ))}
            </div>
            <img
              src={ART.lilyStem}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -bottom-10 -right-12 hidden w-[170px] -rotate-[24deg] select-none xl:block"
            />
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

function Person({
  side,
  label,
  city,
  time,
  detail,
  portrait,
}: {
  side: "left" | "right";
  label: string;
  city: string;
  time: string;
  detail: string;
  portrait: string;
}) {
  const right = side === "right";
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center @min-[570px]:flex-row @min-[570px]:gap-4 ${
        right ? "@min-[570px]:flex-row-reverse @min-[570px]:text-right" : "@min-[570px]:text-left"
      }`}
    >
      <ChibiTile
        src={portrait}
        alt={label}
        className="h-[96px] w-[84px] @min-[420px]:h-[110px] @min-[420px]:w-[96px] @min-[570px]:h-[128px] @min-[570px]:w-[112px]"
      />
      <div className="min-w-0">
        <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#6b7397] @min-[570px]:text-[13px]">
          {label}
        </div>
        <div
          className={`mt-1 flex items-center justify-center gap-1.5 font-serif text-[18px] font-semibold text-sn-navy @min-[570px]:mt-1.5 @min-[570px]:text-[21px] ${right ? "@min-[570px]:justify-end" : "@min-[570px]:justify-start"}`}
        >
          <MapPin size={17} strokeWidth={1.7} className="shrink-0 text-sn-navy" />
          <span className="max-w-[8.5rem] truncate">{city}</span>
        </div>
        <div className="mt-1 font-serif text-[25px] font-bold leading-tight text-sn-navy tabular-nums @min-[570px]:mt-1.5 @min-[570px]:text-[31px]">
          {time}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-[#545e88] @min-[570px]:whitespace-nowrap @min-[570px]:text-[13.5px]">
          {detail}
        </div>
      </div>
    </div>
  );
}
