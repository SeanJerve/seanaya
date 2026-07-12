import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format, subMonths } from "date-fns";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import { Plus, Sparkles } from "lucide-react";
import { Lightbox } from "@/lib/Lightbox";

export function HomeView({ relationshipId, anniversary }: { relationshipId: string; anniversary: string | null }) {
  const name = pinStorage.getName() ?? "you";
  const { openSheet, setTab } = useAppStore();
  const [lightbox, setLightbox] = useState<string | null>(null);

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
      // Prefer featured memory from previous month; fall back to any from that month.
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

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 py-6 pb-32">
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_18px_40px_-24px_rgba(80,110,160,0.35)]">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">A quiet hello</div>
        <div className="display mt-1 text-3xl leading-tight">Hi, {name}.</div>
        {days !== null ? (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="display text-4xl leading-none">{days}</span>
            <span className="text-sm text-muted-foreground">days together</span>
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground italic">Set your anniversary in More → Settings.</div>
        )}
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
              No memory from last month yet. Add one and it will replay next monthsary.
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Memories" value={stats?.memories ?? 0} />
        <Stat label="Trips" value={stats?.trips ?? 0} />
        <Stat label="Hugs" value={stats?.hugs ?? 0} />
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Next moment</div>
          <button onClick={() => setTab("calendar")} className="text-[11px] text-primary">See all</button>
        </div>
        {stats?.nextEvent ? (
          <div className="mt-2">
            <div className="display text-xl leading-tight">{stats.nextEvent.title}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(stats.nextEvent.starts_at), "EEE, MMM d · h:mm a")}</div>
            <div className="mt-1 text-xs text-primary">in {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), new Date()))} days</div>
          </div>
        ) : (
          <button onClick={() => openSheet("add-event")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-3 text-sm text-muted-foreground">
            <Plus size={14} /> Add something to look forward to
          </button>
        )}
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recent memories</div>
          <button onClick={() => setTab("memories")} className="text-[11px] text-primary">See all</button>
        </div>
        {stats?.recent.length ? (
          <ul className="mt-3 space-y-2">
            {stats.recent.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/40 px-3 py-2">
                {m.cover_url ? (
                  <img src={m.cover_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                ) : <span className="h-10 w-10 shrink-0 rounded-xl bg-white/60" />}
                <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {m.memory_date ? format(new Date(m.memory_date), "MMM d") : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <button onClick={() => openSheet("add-memory")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/25 py-3 text-sm text-muted-foreground">
            <Plus size={14} /> Capture your first memory
          </button>
        )}
      </section>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/50 backdrop-blur-xl p-3 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
      <div className="display text-2xl leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
