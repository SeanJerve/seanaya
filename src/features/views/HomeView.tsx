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
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BookHeart,
  MapPin,
  Heart,
  Camera,
  Plane,
  Clock,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Lightbox } from "@/lib/Lightbox";
import { useUser } from "@/hooks/useUser";
import { useRelationship } from "@/hooks/useRelationship";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";

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

  const { data: recentAction, isLoading: loadingAction } = useQuery({
    queryKey: ["recent-partner-action", relationshipId, user?.id],
    enabled: !!user && !!relationshipId,
    queryFn: async () => {
      // 1. Get relationship details to determine partner ID
      const { data: rel } = await supabase
        .from("relationships")
        .select("*")
        .eq("id", relationshipId)
        .single();
      if (!rel) return null;
      const partnerId = rel.user_a_id === user!.id ? rel.user_b_id : rel.user_a_id;
      if (!partnerId) return null;

      // 2. Fetch partner profile
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", partnerId)
        .maybeSingle();
      const partnerName = rel.user_a_id === user!.id ? rel.name_b : rel.name_a;

      // 3. Fetch latest notification for current user
      const { data: latestNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("relationship_id", relationshipId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestNotif) {
        // Fallback: If no notifications yet, let's fetch the latest note created by partner
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
            partnerName: partnerName || "Partner",
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

      // Fetch the actual item details based on latestNotif.kind and ref_id
      let item: any = null;
      let text = "shared something";
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
        text = "captured a memory";
      } else if (latestNotif.kind === "trip") {
        const { data } = await supabase
          .from("trips")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "pinned a dream place";
      } else if (latestNotif.kind === "event") {
        const { data } = await supabase
          .from("events")
          .select("*")
          .eq("id", latestNotif.ref_id)
          .maybeSingle();
        item = data;
        text = "created a moment";
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
        text = "sent you a hug";
      }

      return {
        partnerName: partnerName || "Partner",
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

  // Latest wall note for greeting preview
  const { data: latestNote } = useQuery({
    queryKey: ["latest-note", relationshipId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id,body,kind,color,image_url")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
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

  // Memories and note photos with photos for calendar circles
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
  const prevMonthStart = subMonths(today, 1);
  prevMonthStart.setDate(1);
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

  const { data: monthsaryMemory } = useQuery({
    enabled: isMonthsary,
    queryKey: ["monthsary", relationshipId, format(prevMonthStart, "yyyy-MM")],
    queryFn: async () => {
      const base = supabase
        .from("memories")
        .select("id,title,memory_date,description,cover_url,featured")
        .eq("relationship_id", relationshipId)
        .gte("memory_date", format(prevMonthStart, "yyyy-MM-dd"))
        .lte("memory_date", format(prevMonthEnd, "yyyy-MM-dd"))
        .order("featured", { ascending: false })
        .order("memory_date", { ascending: false })
        .limit(1);
      return (await base).data?.[0] ?? null;
    },
  });

  const start = new Date((anniversary || "2026-06-19") + "T00:00:00");
  const months =
    (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());

  const [timeTogether, setTimeTogether] = useState<{
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

  const greatestUnit = useMemo(() => {
    if (!timeTogether) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (timeTogether.years > 0) {
      return {
        value: timeTogether.years,
        label: timeTogether.years === 1 ? "Year" : "Years",
        subText: `${timeTogether.months}m ${timeTogether.days}d ${pad(timeTogether.hours)}h ${pad(timeTogether.mins)}m ${pad(timeTogether.secs)}s`,
      };
    }
    if (timeTogether.months > 0) {
      return {
        value: timeTogether.months,
        label: timeTogether.months === 1 ? "Month" : "Months",
        subText: `${timeTogether.days}d ${pad(timeTogether.hours)}h ${pad(timeTogether.mins)}m ${pad(timeTogether.secs)}s`,
      };
    }
    return {
      value: timeTogether.days,
      label: timeTogether.days === 1 ? "Day" : "Days",
      subText: `${pad(timeTogether.hours)}h ${pad(timeTogether.mins)}m ${pad(timeTogether.secs)}s`,
    };
  }, [timeTogether]);

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
      toast.success(`A warm hug sent to ${partnerName}`);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const [bacolodTime, setBacolodTime] = useState(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }).format(new Date());
    } catch {
      return format(new Date(), "h:mm:ss a");
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        setBacolodTime(
          new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
          }).format(new Date()),
        );
      } catch {
        setBacolodTime(format(new Date(), "h:mm:ss a"));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div className="mx-auto max-w-md md:max-w-4xl lg:max-w-5xl px-4 sm:px-6 py-6 pb-32">
      {/* ── 3rd Monthsary Story Banner (shown on monthsary day) ── */}
      {isMonthsary && (
        <section
          onClick={openMonthsary}
          className="mb-5 cursor-pointer relative overflow-hidden rounded-3xl border border-white/50 bg-white/50 backdrop-blur-xl px-4 py-3.5 shadow-sm hover:bg-white/60 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="display text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Happy Monthsary, {partnerName}</span>
                <Heart size={13} className="text-primary fill-primary shrink-0" />
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Tap to view our milestone story
              </div>
            </div>
            <div className="text-[11px] font-medium text-foreground/80 bg-white/60 px-3 py-1 rounded-full border border-white/40 shadow-2xs">
              View
            </div>
          </div>
        </section>
      )}

      {/* ── Responsive 2-Column Grid on Tablet/Desktop ── */}
      <div className="md:grid md:grid-cols-12 md:gap-6 space-y-5 md:space-y-0 items-start">
        {/* Left Column (Feed, LDR Link & Daily Moments) */}
        <div className="space-y-5 md:col-span-7">
          {/* ── LDR Connection Hub ── */}
          <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-white/70 via-sky-50/40 to-pink-50/40 backdrop-blur-xl p-5 shadow-sm space-y-4">
            {/* Top bar: live presence & location route */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-foreground/80 tracking-wide">
                  Live Connection
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-white/60 px-2.5 py-1 rounded-full border border-white/40 shadow-2xs tabular-nums">
                <Clock size={12} className="text-primary/70" />
                <span>Bacolod: {bacolodTime}</span>
              </div>
            </div>

            {/* Route visualization */}
            <div className="flex items-center justify-between bg-white/50 border border-white/40 rounded-2xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0 font-bold text-xs">
                  B
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">Bacolod</div>
                  <div className="text-[10px] text-muted-foreground">Sean's home</div>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center px-3">
                <div className="w-full flex items-center gap-1">
                  <div className="h-[1.5px] flex-1 bg-gradient-to-r from-sky-400/50 via-primary/60 to-pink-400/50" />
                  <Plane size={14} className="text-primary shrink-0 transform rotate-45" />
                  <div className="h-[1.5px] flex-1 bg-gradient-to-r from-primary/60 via-pink-400/50 to-pink-500/50" />
                </div>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/80 mt-1">
                  Connected across distance
                </span>
              </div>

              <div className="flex items-center gap-2 min-w-0 text-right">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{partnerName}</div>
                  <div className="text-[10px] text-muted-foreground">My heart</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center text-pink-700 shrink-0 font-bold text-xs">
                  {partnerName.slice(0, 1).toUpperCase()}
                </div>
              </div>
            </div>

            {/* 4 Quick Action Glass Pills */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => setTab("photobooth")}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-white/60 hover:bg-white/80 active:scale-95 transition-all border border-white/50 shadow-2xs group touch-manipulation"
                title="Open Remote Photo Booth"
              >
                <div className="w-8 h-8 rounded-full bg-pink-500/10 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera size={16} />
                </div>
                <span className="text-[10px] font-semibold text-foreground/80">Booth</span>
              </button>

              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([40, 80, 40]);
                  }
                  hug.mutate();
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-white/60 hover:bg-white/80 active:scale-95 transition-all border border-white/50 shadow-2xs group touch-manipulation"
                title="Send a warm hug"
              >
                <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart size={16} className="fill-rose-500/30" />
                </div>
                <span className="text-[10px] font-semibold text-foreground/80">Hug</span>
              </button>

              <button
                onClick={() => openSheet("add-note")}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-white/60 hover:bg-white/80 active:scale-95 transition-all border border-white/50 shadow-2xs group touch-manipulation"
                title="Post a sticky note"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare size={16} />
                </div>
                <span className="text-[10px] font-semibold text-foreground/80">Note</span>
              </button>

              <button
                onClick={() => openSheet("add-memory")}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-white/60 hover:bg-white/80 active:scale-95 transition-all border border-white/50 shadow-2xs group touch-manipulation"
                title="Capture a memory"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={16} />
                </div>
                <span className="text-[10px] font-semibold text-foreground/80">Memory</span>
              </button>
            </div>
          </section>

          {/* ── Greeting strip with wall preview ── */}
          <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] overflow-hidden">
            <div className="grid grid-cols-2 items-stretch divide-x divide-white/40 gap-0">
              {/* Left: greeting text */}
              <div
                {...longPressProps}
                className="px-5 py-4 min-w-0 flex flex-col justify-between cursor-pointer hover:bg-white/10 transition-colors"
                title="Hold to see space guide"
              >
                <div>
                  <div className="display truncate text-2xl leading-tight font-semibold">
                    Hi, {name}.
                  </div>

                  {greatestUnit && (
                    <div className="mt-3 flex flex-col justify-end">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold mb-0.5">
                        We've been together for:
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="display text-2.5xl font-black text-primary leading-none tracking-tight">
                          {greatestUnit.value}
                        </span>
                        <span className="display text-[10px] font-extrabold text-primary/75 uppercase tracking-wider">
                          {greatestUnit.label}
                        </span>
                      </div>
                      <div className="display text-xs font-bold text-foreground/60 leading-none mt-1.5 tabular-nums tracking-wide">
                        {greatestUnit.subText}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Recently activity feed */}
              <div
                className="cursor-pointer relative overflow-hidden min-h-[110px] flex flex-col justify-between p-3 bg-white/10 hover:bg-white/15 transition-colors"
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
                title={recentAction ? "Recently active" : "No recent activity"}
              >
                {loadingAction ? (
                  <div className="flex flex-col h-full justify-between gap-1.5 animate-pulse">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-foreground/10 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2 w-12 bg-foreground/10 rounded" />
                        <div className="h-1.5 w-16 bg-foreground/10 rounded" />
                      </div>
                    </div>
                    <div className="flex-1 rounded-lg bg-foreground/5 mt-2" />
                  </div>
                ) : recentAction ? (
                  <div className="flex flex-col h-full justify-between gap-1.5">
                    {/* Partner User row */}
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-5 h-5 rounded-full bg-white/60 dark:bg-black/30 border border-white/40 overflow-hidden flex items-center justify-center shrink-0">
                        {recentAction.partnerAvatar ? (
                          <img
                            src={recentAction.partnerAvatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[9px] font-bold text-foreground/60">
                            {recentAction.partnerName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-[9px] leading-tight">
                        <span className="text-foreground/80 font-bold mr-1">
                          {recentAction.partnerName}
                        </span>
                        <span className="text-muted-foreground/90 text-[8px]">
                          {recentAction.text}
                        </span>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="flex-1 min-h-0 flex items-center justify-center">
                      {recentAction.kind === "note" && recentAction.item?.image_url ? (
                        <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/30 shadow-sm">
                          <img
                            src={recentAction.item.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : recentAction.kind === "note" && recentAction.item ? (
                        <div
                          className="w-full h-full rounded-lg p-2 flex flex-col justify-between overflow-hidden shadow-inner border border-white/20"
                          style={{
                            background: recentAction.item.color ?? "oklch(0.95 0.03 85 / 0.6)",
                          }}
                        >
                          <p className="text-[10px] text-foreground/80 line-clamp-3 leading-tight font-[Nunito] break-words whitespace-pre-wrap">
                            {recentAction.item.body}
                          </p>
                        </div>
                      ) : recentAction.kind === "memory" && recentAction.item ? (
                        <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/30 shadow-sm bg-black/5">
                          {recentAction.item.cover_url ? (
                            <img
                              src={recentAction.item.cover_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold p-1 text-center line-clamp-2">
                              {recentAction.item.title}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full text-center text-[11px] font-semibold text-foreground/80 truncate">
                          {recentAction.item?.title || recentAction.item?.body || "Something sweet"}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-foreground/30 p-4">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                    <span className="text-[9px] uppercase tracking-wider text-center font-semibold text-foreground/45">
                      No activity yet
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── What matters today ── */}
          <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              What matters today
            </div>

            {/* Next event */}
            <div className="rounded-2xl bg-white/60 p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <CalendarIcon size={11} /> Next moment
              </div>
              {loadingStats ? (
                <div className="mt-2 space-y-1.5 animate-pulse">
                  <div className="h-4 w-32 bg-foreground/10 rounded" />
                  <div className="h-3 w-24 bg-foreground/10 rounded mt-1" />
                  <div className="h-3 w-16 bg-foreground/10 rounded mt-1.5" />
                </div>
              ) : stats?.nextEvent ? (
                <button onClick={() => setTab("calendar")} className="mt-1 block w-full text-left">
                  <div className="display text-lg leading-tight">{stats.nextEvent.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(stats.nextEvent.starts_at), "EEE, MMM d · h:mm a")}
                  </div>
                  <div className="mt-0.5 text-[11px] text-primary">
                    in{" "}
                    {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), new Date()))}{" "}
                    days
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => openSheet("add-event")}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-2.5 text-[12px] text-muted-foreground"
                >
                  <Plus size={12} /> Add something to look forward to
                </button>
              )}
            </div>

            {/* Recent memory */}
            <div className="rounded-2xl bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <BookHeart size={11} /> Recent memories
                </div>
                <button onClick={() => setTab("calendar")} className="text-[11px] text-primary">
                  See all
                </button>
              </div>
              {loadingStats ? (
                <div className="mt-2 space-y-1.5 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl bg-white/50 px-2.5 py-1.5"
                    >
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-foreground/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-28 bg-foreground/10 rounded" />
                      </div>
                      <div className="h-2.5 w-10 bg-foreground/10 rounded shrink-0" />
                    </div>
                  ))}
                </div>
              ) : stats?.recent.length ? (
                <ul className="mt-2 space-y-1.5">
                  {stats.recent.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-xl bg-white/50 px-2.5 py-1.5"
                    >
                      {m.cover_url ? (
                        <img
                          src={m.cover_url}
                          alt=""
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="h-9 w-9 shrink-0 rounded-lg bg-white/70" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {m.memory_date ? format(new Date(m.memory_date), "MMM d") : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  onClick={() => openSheet("add-memory")}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-2.5 text-[12px] text-muted-foreground"
                >
                  <Plus size={12} /> Capture your first memory
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Right Column (Widgets, Milestone Ring & Calendar) */}
        <div className="space-y-5 md:col-span-5">
          {/* ── LDR Photo Booth Banner ── */}
          <section
            onClick={() => setTab("photobooth")}
            className="cursor-pointer relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-sky-500/15 backdrop-blur-xl p-4 shadow-sm hover:bg-white/60 transition-all active:scale-[0.98] group flex items-center justify-between touch-manipulation"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-black/30 border border-white/60 flex items-center justify-center text-pink-500 shadow-sm group-hover:scale-105 transition-transform">
                <Camera size={20} />
              </div>
              <div>
                <div className="display text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>LDR Photo Booth</span>
                  <Sparkles size={13} className="text-amber-500 shrink-0" />
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Bacolod ✈ {partnerName} • Take a synced 4-cut strip
                </div>
              </div>
            </div>
            <div className="text-xs font-semibold text-primary bg-white/80 px-3.5 py-1.5 rounded-full border border-white/40 shadow-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              Enter
            </div>
          </section>

          {/* ── Anniversary Milestone Ring Card ── */}
          <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                Our Journey
              </div>
              <div className="text-[10px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Every 19th
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/40 border border-white/40 rounded-2xl p-4 shadow-2xs">
              {/* Circular SVG Ring */}
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    className="text-foreground/10"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    className="text-primary transition-all duration-1000"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * (1 - cycleProgress / 100)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="display text-base font-bold leading-none tabular-nums text-foreground">
                    {daysToNextMonthsary}
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                    days left
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="display text-sm font-bold text-foreground">
                  {daysToNextMonthsary === 0
                    ? "Happy Monthsary Day! 🎉"
                    : `Next Monthsary in ${daysToNextMonthsary} days`}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Celebrating our love on the 19th of every month. Each day brings us closer
                  together.
                </p>
              </div>
            </div>

            {/* Mini stats counters */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <MiniStat
                icon={<BookHeart size={11} className="text-primary" />}
                label="Memories"
                value={stats?.memories ?? 0}
              />
              <MiniStat
                icon={<Heart size={11} className="text-rose-500 fill-rose-500/20" />}
                label="Hugs"
                value={stats?.hugs ?? 0}
              />
              <MiniStat
                icon={<MapPin size={11} className="text-sky-500" />}
                label="Trips"
                value={stats?.trips ?? 0}
              />
            </div>
          </section>

          {/* ── Calendar (now on right side on desktop) ── */}
          <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCursor(subMonths(cursor, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-90 transition-all touch-manipulation text-foreground/80"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setTab("calendar")} className="display text-lg font-semibold">
                {format(cursor, "MMMM yyyy")}
              </button>
              <button
                onClick={() => setCursor(addMonths(cursor, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-90 transition-all touch-manipulation text-foreground/80"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
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
                    className={`relative aspect-square flex items-center justify-center rounded-full overflow-hidden
                  ${isToday ? "ring-2 ring-foreground/40" : "hover:bg-black/5"}
                  ${!isSameMonth(d, cursor) ? "opacity-30" : ""}`}
                  >
                    {dayPhoto?.url && (
                      <>
                        <img
                          src={dayPhoto.url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-white/15 border border-white/40 rounded-full" />
                      </>
                    )}
                    <span
                      className={`relative z-10 text-xs font-medium ${isToday ? "text-foreground" : dayPhoto ? "text-foreground/90" : ""}`}
                    >
                      {d.getDate()}
                    </span>
                    {hasEvent && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-hug z-10" />
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
        title="Cozy Space"
        description="Welcome home, love. This is our little shared space in the digital world. Here, you can see how many days we've cherished together, check what we're looking forward to, and view a glimpse of our latest moments. Tap around and let's build our world together."
      />

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/60 py-2 text-center">
      <div className="display text-lg leading-none">{value}</div>
      <div className="mt-1 flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
    </div>
  );
}
