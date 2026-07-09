import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth, getDay } from "date-fns";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePanel } from "@/features/app/store";

export function CalendarPanel({ relationshipId }: { relationshipId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const { setPanel } = usePanel();
  const qc = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ["events", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const s = startOfMonth(cursor).toISOString();
      const e = endOfMonth(cursor).toISOString();
      const { data, error } = await supabase.from("events").select("*")
        .eq("relationship_id", relationshipId).gte("starts_at", s).lte("starts_at", e).order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));

  const today = new Date();
  const isMonthsary = today.getDate() === 19;

  return (
    <div className="glass-panel h-full flex flex-col p-5">
      <div className="flex items-center justify-between">
        <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-1.5 rounded-full hover:bg-accent transition"><ChevronLeft size={16} /></button>
        <h3 className="display text-lg">{format(cursor, "MMMM yyyy")}</h3>
        <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1.5 rounded-full hover:bg-accent transition"><ChevronRight size={16} /></button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const has = events.some((e) => isSameDay(new Date(e.starts_at), d));
          const isToday = isSameDay(d, today);
          const isMonthsaryDay = d.getDate() === 19;
          return (
            <div key={d.toISOString()} className={`aspect-square flex items-center justify-center rounded-full text-xs transition
              ${isToday ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"}
              ${!isSameMonth(d, cursor) ? "opacity-30" : ""} relative`}>
              {d.getDate()}
              {has && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-hug" />}
              {isMonthsaryDay && !has && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-lily-stem opacity-60" />}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex-1 overflow-auto space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">This month</div>
        {events.length === 0 && (
          <div className="text-xs text-muted-foreground italic">Quiet month. {isMonthsary ? "Today is your monthsary." : "Add a moment worth remembering."}</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="soft-card px-3 py-2 text-xs">
            <div className="font-medium truncate">{e.title}</div>
            <div className="text-muted-foreground">{format(new Date(e.starts_at), "MMM d · h:mm a")}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => { setPanel("event"); qc.invalidateQueries({ queryKey: ["events"] }); }}
        className="mt-3 flex items-center justify-center gap-2 rounded-full bg-primary py-2 text-xs text-primary-foreground shadow-soft hover:opacity-90 transition"
      >
        <Plus size={14} /> Add event
      </button>
    </div>
  );
}
