import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isSameMonth, getDay,
} from "date-fns";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";

export function CalendarView({ relationshipId }: { relationshipId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const { openSheet, confirm } = useAppStore();
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => openSheet("add-event")
  });

  useEffect(() => {
    const key = "intro-dismissed-calendar";
    const val = localStorage.getItem(key);
    if (!val) {
      setShowLongPressInfo(true);
      localStorage.setItem(key, "true");
    }
  }, []);

  const qc = useQueryClient();

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: ["events", relationshipId] });
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
  });

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

  // Fetch memories & note photos this month to show in calendar circles
  const { data: monthPhotos = [] } = useQuery({
    queryKey: ["photos-cal", relationshipId, cursor.getFullYear(), cursor.getMonth()],
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

  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));
  const today = new Date();

  return (
    <div className="mx-auto max-w-md space-y-4 px-5 py-6 pb-32">
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5">
            <ChevronLeft size={16} />
          </button>
          <div className="display text-lg">{format(cursor, "MMMM yyyy")}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-full p-1.5 hover:bg-black/5">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-sm">
          {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const hasEvent = events.some((e) => isSameDay(new Date(e.starts_at), d));
            // Find a photo for this day (either memory or note photo)
            const dayPhoto = monthPhotos.find(
              (p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d)
            );
            const isToday = isSameDay(d, today);
            const inMonth = isSameMonth(d, cursor);

            return (
              <div
                key={d.toISOString()}
                className={`relative aspect-square flex items-center justify-center rounded-full overflow-hidden transition-transform
                  ${!inMonth ? "opacity-30" : ""}
                  ${isToday ? "" : "hover:scale-105"}`}
                title={dayPhoto?.title ?? undefined}
              >
                {/* Photo background for memory / note photo days */}
                {dayPhoto?.url && inMonth && (
                  <>
                    <img
                      src={dayPhoto.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Glass overlay (clearer to show background photo) */}
                    <div className="absolute inset-0 rounded-full border border-white/50 bg-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
                  </>
                )}

                {/* Today highlight ring */}
                {isToday && (
                  <div className="absolute inset-0 rounded-full ring-2 ring-foreground/60 bg-foreground/10" />
                )}

                {/* Plain day bg if no photo */}
                {!dayPhoto && !isToday && (
                  <div className="absolute inset-0 rounded-full hover:bg-black/5" />
                )}

                <span className={`relative z-10 text-xs font-semibold
                  ${isToday ? "text-foreground" : dayPhoto ? "text-foreground/90" : "text-foreground/70"}`}>
                  {d.getDate()}
                </span>

                {/* Event dot */}
                {hasEvent && (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-hug z-10 shadow-[0_0_4px_var(--hug)]" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Events list */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">This month</div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Quiet month. Add something below.</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 border border-white/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">{format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {e.category}
                  </span>
                  <button
                    onClick={(evt) => {
                      evt.stopPropagation();
                      confirm({
                        title: "Delete event?",
                        message: `Are you sure you want to remove "${e.title}" from your calendar?`,
                        onConfirm: () => deleteEvent.mutate(e.id),
                      });
                    }}
                    className="text-foreground/35 hover:text-red-500 transition-colors p-1"
                    title="Delete event"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        {...longPressProps}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)] hover:bg-white/80 active:scale-95 transition-all"
      >
        <Plus size={16} /> Add event
      </button>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Add Event"
        description="Tap to schedule a date or moment to look forward to. You can set the title, choose the date and time, categorize the event, and start a countdown."
      />
    </div>
  );
}
