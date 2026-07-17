import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  differenceInDays, format, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getDay, isSameMonth, addMonths,
} from "date-fns";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import { Plus, Sparkles, ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookHeart, MapPin, Heart } from "lucide-react";
import { Lightbox } from "@/lib/Lightbox";
import { useUser } from "@/hooks/useUser";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";

export function HomeView({ relationshipId, anniversary }: { relationshipId: string; anniversary: string | null }) {
  const name = pinStorage.getName() ?? "you";
  const { openSheet, setTab } = useAppStore();
  const { user } = useUser();

  const { data: recentAction } = useQuery({
    queryKey: ["recent-partner-action", relationshipId, user?.id],
    enabled: !!user && !!relationshipId,
    queryFn: async () => {
      // 1. Get relationship details to determine partner ID
      const { data: rel } = await supabase.from("relationships").select("*").eq("id", relationshipId).single();
      if (!rel) return null;
      const partnerId = rel.user_a_id === user!.id ? rel.user_b_id : rel.user_a_id;
      if (!partnerId) return null;

      // 2. Fetch partner profile
      const { data: partnerProfile } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      const partnerName = rel.user_a_id === user!.id ? rel.name_b : rel.name_a;

      // 3. Fetch latest notification for current user
      const { data: latestNotif } = await supabase.from("notifications")
        .select("*")
        .eq("relationship_id", relationshipId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestNotif) {
        // Fallback: If no notifications yet, let's fetch the latest note created by partner
        const { data: latestNote } = await supabase.from("notes")
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
            text: "pinned a note"
          };
        }
        return null;
      }

      if (!latestNotif.ref_id) return null;

      // Fetch the actual item details based on latestNotif.kind and ref_id
      let item: any = null;
      let text = "shared something";
      if (latestNotif.kind === "note") {
        const { data } = await supabase.from("notes").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = data?.kind === "photo" ? "shared a polaroid" : "pinned a note";
      } else if (latestNotif.kind === "memory") {
        const { data } = await supabase.from("memories").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = "captured a memory";
      } else if (latestNotif.kind === "trip") {
        const { data } = await supabase.from("trips").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = "pinned a dream place";
      } else if (latestNotif.kind === "event") {
        const { data } = await supabase.from("events").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = "created a moment";
      } else if (latestNotif.kind === "song") {
        const { data } = await supabase.from("songs").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = "shared a song";
      } else if (latestNotif.kind === "hug") {
        const { data } = await supabase.from("hugs").select("*").eq("id", latestNotif.ref_id).maybeSingle();
        item = data;
        text = "sent you a hug";
      }

      return {
        partnerName: partnerName || "Partner",
        partnerAvatar: partnerProfile?.avatar_url,
        kind: latestNotif.kind,
        createdAt: latestNotif.created_at,
        item,
        text
      };
    }
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
    onClick: () => {}
  });

  const { data: monthEvents = [] } = useQuery({
    queryKey: ["events", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const s = startOfMonth(cursor).toISOString();
      const e = endOfMonth(cursor).toISOString();
      const { data } = await supabase.from("events").select("*")
        .eq("relationship_id", relationshipId).gte("starts_at", s).lte("starts_at", e).order("starts_at");
      return data ?? [];
    },
  });

  // Latest wall note for greeting preview
  const { data: latestNote } = useQuery({
    queryKey: ["latest-note", relationshipId],
    queryFn: async () => {
      const { data } = await supabase.from("notes")
        .select("id,body,kind,color,image_url")
        .eq("relationship_id", relationshipId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", relationshipId],
    queryFn: async () => {
      const [mem, trip, hug, next, recent] = await Promise.all([
        supabase.from("memories").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("hugs").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("events").select("*").eq("relationship_id", relationshipId).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
        supabase.from("memories").select("id,title,memory_date,cover_url").eq("relationship_id", relationshipId).order("created_at", { ascending: false }).limit(3),
      ]);
      return {
        memories: mem.count ?? 0, trips: trip.count ?? 0, hugs: hug.count ?? 0,
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
        supabase.from("memories")
          .select("id,memory_date,cover_url,title")
          .eq("relationship_id", relationshipId)
          .gte("memory_date", sDateStart)
          .lte("memory_date", sDateEnd)
          .not("cover_url", "is", null),
        supabase.from("notes")
          .select("id,created_at,image_url,body")
          .eq("relationship_id", relationshipId)
          .eq("kind", "photo")
          .gte("created_at", sStart)
          .lte("created_at", sEnd)
          .not("image_url", "is", null)
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
          list.push({ dateStr: dStr, url: n.image_url, title: n.body !== "(photo)" ? n.body : "Photo Pin" });
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
      const base = supabase.from("memories")
        .select("id,title,memory_date,description,cover_url,featured")
        .eq("relationship_id", relationshipId)
        .gte("memory_date", format(prevMonthStart, "yyyy-MM-dd"))
        .lte("memory_date", format(prevMonthEnd, "yyyy-MM-dd"))
        .order("featured", { ascending: false })
        .order("memory_date", { ascending: false })
        .limit(1)
      return (await base).data?.[0] ?? null;
    },
  });

  const start = anniversary ? new Date(anniversary + "T00:00:00") : null;
  const months = start ? (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) : null;

  const [timeTogether, setTimeTogether] = useState<{
    years: number;
    days: number;
    hours: number;
    mins: number;
    secs: number;
  } | null>(null);

  useEffect(() => {
    if (!start) return;
    
    const update = () => {
      const now = new Date();
      let years = now.getFullYear() - start.getFullYear();
      let m = now.getMonth() - start.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
        years--;
      }
      
      const lastAnniv = new Date(start);
      lastAnniv.setFullYear(start.getFullYear() + years);
      
      const diffMs = now.getTime() - lastAnniv.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      const mins = diffMins % 60;
      const secs = diffSecs % 60;
      
      setTimeTogether({ years, days, hours, mins, secs });
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [anniversary]);

  const gridDays = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));

  const todayDate = new Date().getDate();
  const basePrompts = [
    "Share a song that made you think of them today.",
    "Pin a cute sticky note to surprise them!",
    "Send a warm virtual hug right now.",
    "Every single second spent together is a gift.",
    "What is your favorite memory of us in the past month?",
    "Hope your partner is having a wonderful day!",
    "Daily Prompt: Tell them one thing you appreciate about them today.",
  ];
  
  let promptText = basePrompts[todayDate % basePrompts.length];
  if (stats) {
    if (todayDate % 3 === 0 && stats.memories > 0) {
      promptText = `We have kept ${stats.memories} memories together!`;
    } else if (todayDate % 3 === 1 && stats.trips > 0) {
      promptText = `We have ${stats.trips} dream places pinned!`;
    } else if (todayDate % 3 === 2 && stats.hugs > 0) {
      promptText = `You have sent each other ${stats.hugs} hugs!`;
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 py-6 pb-32">
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
              <div className="display truncate text-2xl leading-tight font-semibold">Hi, {name}.</div>
              <p className="text-[10px] text-muted-foreground/80 mt-1 leading-normal italic font-medium max-w-full overflow-hidden text-ellipsis line-clamp-2">
                {promptText}
              </p>
              
              {timeTogether && (
                <div className="mt-3.5 space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-bold">We have been together for:</div>
                  <div className="display text-[15px] font-bold text-primary leading-tight">
                    {timeTogether.years > 0 ? `${timeTogether.years}y ` : ""}
                    {`${timeTogether.days}d ${timeTogether.hours}h ${timeTogether.mins}m ${timeTogether.secs}s`}
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
            {recentAction ? (
              <div className="flex flex-col h-full justify-between gap-1.5">
                {/* Partner User row */}
                <div className="flex items-center gap-1.5">
                  <div className="relative w-5 h-5 rounded-full bg-white/60 dark:bg-black/30 border border-white/40 overflow-hidden flex items-center justify-center shrink-0">
                    {recentAction.partnerAvatar ? (
                      <img src={recentAction.partnerAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold text-foreground/60">{recentAction.partnerName.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] text-foreground/80 font-bold truncate leading-none">{recentAction.partnerName}</div>
                    <div className="text-[8px] text-muted-foreground/90 truncate mt-0.5 leading-none">{recentAction.text}</div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  {recentAction.kind === "note" && recentAction.item?.image_url ? (
                    <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/30 shadow-sm">
                      <img src={recentAction.item.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : recentAction.kind === "note" && recentAction.item ? (
                    <div
                      className="w-full h-full rounded-lg p-2 flex flex-col justify-between overflow-hidden shadow-inner border border-white/20"
                      style={{ background: recentAction.item.color ?? "oklch(0.95 0.03 85 / 0.6)" }}
                    >
                      <p className="text-[10px] text-foreground/80 line-clamp-3 leading-tight font-[Nunito] break-words whitespace-pre-wrap">
                        {recentAction.item.body}
                      </p>
                    </div>
                  ) : recentAction.kind === "memory" && recentAction.item ? (
                    <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/30 shadow-sm bg-black/5">
                      {recentAction.item.cover_url ? (
                        <img src={recentAction.item.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold p-1 text-center line-clamp-2">{recentAction.item.title}</div>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span className="text-[9px] uppercase tracking-wider text-center font-semibold text-foreground/45">No activity yet</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Cozy Space"
        description="Welcome home, love. This is our little shared space in the digital world. Here, you can see how many days we've cherished together, check what we're looking forward to, and view a glimpse of our latest moments. Tap around and let's build our world together."
      />

      {/* ── What matters today (now FIRST) ── */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">What matters today</div>

        {/* Next event */}
        <div className="rounded-2xl bg-white/60 p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarIcon size={11} /> Next moment
          </div>
          {stats?.nextEvent ? (
            <button onClick={() => setTab("calendar")} className="mt-1 block w-full text-left">
              <div className="display text-lg leading-tight">{stats.nextEvent.title}</div>
              <div className="text-[11px] text-muted-foreground">{format(new Date(stats.nextEvent.starts_at), "EEE, MMM d · h:mm a")}</div>
              <div className="mt-0.5 text-[11px] text-primary">
                in {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), new Date()))} days
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
            <button onClick={() => setTab("memories")} className="text-[11px] text-primary">See all</button>
          </div>
          {stats?.recent.length ? (
            <ul className="mt-2 space-y-1.5">
              {stats.recent.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl bg-white/50 px-2.5 py-1.5">
                  {m.cover_url ? (
                    <img src={m.cover_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : <span className="h-9 w-9 shrink-0 rounded-lg bg-white/70" />}
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

      {/* ── Calendar (now SECOND) ── */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5"><ChevronLeft size={16} /></button>
          <button onClick={() => setTab("calendar")} className="display text-lg">{format(cursor, "MMMM yyyy")}</button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
          {gridDays.map((d) => {
            const hasEvent = monthEvents.some((e) => isSameDay(new Date(e.starts_at), d));
            const dayPhoto = monthPhotos.find((p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d));
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
                    <img src={dayPhoto.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-white/15 border border-white/40 rounded-full" />
                  </>
                )}
                <span className={`relative z-10 text-xs font-medium ${isToday ? "text-foreground" : dayPhoto ? "text-foreground/90" : ""}`}>
                  {d.getDate()}
                </span>
                {hasEvent && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-hug z-10" />}
              </div>
            );
          })}
        </div>
      </section>

      {isMonthsary && (
        <section className="overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-white/70 to-primary/10 backdrop-blur-xl">
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
              <Sparkles size={12} /> Monthsary {months != null ? `· ${months} months` : ""}
            </div>
            <div className="display mt-1 text-xl leading-tight">A little rewind</div>
            <p className="mt-1 text-xs text-muted-foreground">From last month, replayed for today.</p>
          </div>
          {monthsaryMemory ? (
            <div className="border-t border-white/40 bg-white/30 p-4">
              {monthsaryMemory.cover_url && (
                <button onClick={() => setLightbox(monthsaryMemory.cover_url)} className="mb-3 block w-full">
                  <img src={monthsaryMemory.cover_url} alt="" className="h-40 w-full rounded-2xl object-cover" />
                </button>
              )}
              <div className="text-xs text-muted-foreground">{monthsaryMemory.memory_date && format(new Date(monthsaryMemory.memory_date), "MMM d, yyyy")}</div>
              <div className="display text-lg leading-tight">{monthsaryMemory.title}</div>
              {monthsaryMemory.description && <p className="mt-1 text-sm text-foreground/80 line-clamp-3">{monthsaryMemory.description}</p>}
            </div>
          ) : (
            <div className="border-t border-white/40 bg-white/30 p-4 text-xs italic text-muted-foreground">
              No memory from last month yet.
            </div>
          )}
        </section>
      )}

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
