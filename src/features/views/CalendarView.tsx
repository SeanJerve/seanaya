import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, getDay } from "date-fns";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAppStore } from "@/features/app/store";

export function CalendarView({ relationshipId }: { relationshipId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const { openSheet } = useAppStore();

  const { data: events = [] } = useQuery({
    queryKey: ["events", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const s = startOfMonth(cursor).toISOString();
      const e = endOfMonth(cursor).toISOString();
      const { data } = await supabase.from("events").select("*")
        .eq("relationship_id", relationshipId).gte("starts_at", s).lte("starts_at", e).order("starts_at");
      return data ?? [];
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));
  const today = new Date();

  return (
    <div className="mx-auto max-w-md space-y-4 px-5 py-6 pb-32">
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5"><ChevronLeft size={16} /></button>
          <div className="display text-lg">{format(cursor, "MMMM yyyy")}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5"><ChevronRight size={16} /></button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const has = events.some((e) => isSameDay(new Date(e.starts_at), d));
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

      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">This month</div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Quiet month. Add something below.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-2xl bg-white/50 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">{format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}</div>
                </div>
                <span className="ml-3 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{e.category}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => openSheet("add-event")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50
          bg-white/60 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)]"
      >
        <Plus size={16} /> Add event
      </button>
    </div>
  );
}
