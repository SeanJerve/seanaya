import { useState } from "react";
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

export function HomeView({ relationshipId, anniversary }: { relationshipId: string; anniversary: string | null }) {
  const name = pinStorage.getName() ?? "you";
  const { openSheet, setTab } = useAppStore();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date());

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
        .limit(1);
      return (await base).data?.[0] ?? null;
    },
  });

  const start = anniversary ? new Date(anniversary) : null;
  const days = start ? differenceInDays(new Date(), start) : null;
  const months = start ? (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) : null;

  const gridDays = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 py-6 pb-32">

      {/* Greeting strip */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl px-5 py-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">A quiet hello</div>
            <div className="display truncate text-2xl leading-tight">Hi, {name}.</div>
          </div>
          {days !== null && (
            <div className="text-right">
              <div className="display text-2xl leading-none">{days}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">days</div>
            </div>
          )}
        </div>
      </section>

      {/* Calendar (primary) */}
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
            const has = monthEvents.some((e) => isSameDay(new Date(e.starts_at), d));
            const isToday = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className={`relative aspect-square flex items-center justify-center rounded-full
                  ${isToday ? "bg-foreground text-background font-medium" : "hover:bg-black/5"}
                  ${!isSameMonth(d, cursor) ? "opacity-30" : ""}`}
              >
                {d.getDate()}
                {has && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-hug" />}
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

      {/* Priorities container */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">What matters today</div>
        </div>

        {/* Next event */}
        <div className="rounded-2xl bg-white/60 p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarIcon size={11} /> Next moment
          </div>
          {stats?.nextEvent ? (
            <button onClick={() => setTab("calendar")} className="mt-1 block w-full text-left">
              <div className="display text-lg leading-tight">{stats.nextEvent.title}</div>
              <div className="text-[11px] text-muted-foreground">{format(new Date(stats.nextEvent.starts_at), "EEE, MMM d · h:mm a")}</div>
              <div className="mt-0.5 text-[11px] text-primary">in {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), new Date()))} days</div>
            </button>
          ) : (
            <button onClick={() => openSheet("add-event")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-2.5 text-[12px] text-muted-foreground">
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
            <button onClick={() => openSheet("add-memory")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-2.5 text-[12px] text-muted-foreground">
              <Plus size={12} /> Capture your first memory
            </button>
          )}
        </div>

        {/* Quiet counters */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <MiniStat icon={<BookHeart size={11} />} label="Memories" value={stats?.memories ?? 0} />
          <MiniStat icon={<MapPin size={11} />}    label="Trips"    value={stats?.trips ?? 0} />
          <MiniStat icon={<Heart size={11} />}     label="Hugs"     value={stats?.hugs ?? 0} />
        </div>
      </section>

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
