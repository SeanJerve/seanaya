import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isSameMonth,
  getDay,
} from "date-fns";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  Tag,
  X,
  Maximize2,
  Minimize2,
  CalendarDays,
  BookHeart,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/useLongPress";
import { LongPressModal } from "@/components/ui/LongPressModal";
import { Lightbox } from "@/lib/Lightbox";
import { motion, AnimatePresence } from "framer-motion";

type Memory = {
  id: string;
  title: string;
  description: string | null;
  memory_date: string | null;
  category: string;
  location: string | null;
  cover_url: string | null;
  created_at: string;
};

export function CalendarView({ relationshipId }: { relationshipId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const { openSheet, confirm } = useAppStore();
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isFullscreenTimeline, setIsFullscreenTimeline] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(360);

  const longPressProps = useLongPress({
    onLongPress: () => setShowLongPressInfo(true),
    onClick: () => openSheet("add-event"),
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

  const deleteMemory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("memories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Memory deleted");
      qc.invalidateQueries({ queryKey: ["memories", relationshipId] });
      setActiveMemory(null);
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
  });

  const { data: events = [] } = useQuery({
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

  const { data: memories = [], isLoading: loadingMemories } = useQuery({
    queryKey: ["memories", relationshipId],
    queryFn: async () =>
      ((
        await supabase
          .from("memories")
          .select("id,title,description,memory_date,category,location,cover_url,created_at")
          .eq("relationship_id", relationshipId)
          .order("memory_date", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(100)
      ).data ?? []) as Memory[],
  });

  // Group memories by date
  const groupedMemories = useMemo(() => {
    const groups: { [dateStr: string]: Memory[] } = {};
    const noDateMemories: Memory[] = [];

    memories.forEach((m) => {
      if (m.memory_date) {
        if (!groups[m.memory_date]) {
          groups[m.memory_date] = [];
        }
        groups[m.memory_date].push(m);
      } else {
        noDateMemories.push(m);
      }
    });

    const list: { date: string | null; memories: Memory[] }[] = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((dateStr) => ({
        date: dateStr,
        memories: groups[dateStr],
      }));

    if (noDateMemories.length > 0) {
      list.push({
        date: null,
        memories: noDateMemories,
      });
    }

    return list;
  }, [memories]);

  // Extract unique dates for date skip picker
  const availableDates = useMemo(() => {
    return groupedMemories.map((g) => g.date).filter((d): d is string => d !== null);
  }, [groupedMemories]);

  // Track container width for timeline S-curve rendering
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // Subtract padding to fit grid
        setContainerWidth(entries[0].contentRect.width - 40);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isTimelineOpen, isFullscreenTimeline]);

  // Fetch memories & note photos this month to show in calendar circles
  const { data: monthPhotos = [] } = useQuery({
    queryKey: ["photos-cal", relationshipId, cursor.getFullYear(), cursor.getMonth()],
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

  const days = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  const leading = getDay(startOfMonth(cursor));
  const today = new Date();

  // Timeline S-curve drawing coordinates
  const rowHeight = 185;
  const cx_0 = containerWidth / 6;
  const cx_1 = containerWidth / 2;
  const cx_2 = (containerWidth * 5) / 6;

  const points = useMemo(() => {
    return groupedMemories.map((_, i) => {
      const rem = i % 4;
      let x = cx_1;
      if (rem === 0) x = cx_0;
      else if (rem === 2) x = cx_2;
      return { x, y: i * rowHeight + 85 };
    });
  }, [groupedMemories, containerWidth]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1y = prev.y + rowHeight / 2;
      const cp2y = curr.y - rowHeight / 2;
      d += ` C ${prev.x} ${cp1y}, ${curr.x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [points]);

  const matchingDateGroups = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    return groupedMemories.filter((group) => {
      if (group.date) {
        const formatted = format(new Date(group.date + "T00:00:00"), "MMM d, yyyy").toLowerCase();
        if (formatted.includes(query) || group.date.toLowerCase().includes(query)) return true;
      }
      return group.memories.some((m) => {
        const title = (m.title || "").toLowerCase();
        const desc = (m.description || "").toLowerCase();
        const cat = (m.category || "").toLowerCase();
        const loc = (m.location || "").toLowerCase();
        return (
          title.includes(query) ||
          desc.includes(query) ||
          cat.includes(query) ||
          loc.includes(query)
        );
      });
    });
  }, [groupedMemories, searchQuery]);

  useEffect(() => {
    if (matchingDateGroups.length === 0) return;
    const activeMatch = matchingDateGroups[activeSearchIndex];
    if (activeMatch) {
      const prefix = isFullscreenTimeline ? "fullscreen-bubble-" : "bubble-";
      const elId = `${prefix}${activeMatch.date || ""}`;
      const el = document.getElementById(elId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(
          "ring-4",
          "ring-primary",
          "ring-offset-2",
          "scale-105",
          "transition-all",
          "duration-500",
        );
        const timer = setTimeout(() => {
          el.classList.remove("ring-4", "ring-primary", "ring-offset-2", "scale-105");
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [activeSearchIndex, searchQuery, isFullscreenTimeline, matchingDateGroups]);

  const getColClass = (idx: number) => {
    const rem = idx % 4;
    if (rem === 0) return "col-start-1 justify-self-center";
    if (rem === 1 || rem === 3) return "col-start-2 justify-self-center";
    return "col-start-3 justify-self-center";
  };

  const renderTimeline = () => (
    <div
      className="relative w-full mt-4"
      style={{
        minHeight: loadingMemories
          ? "auto"
          : groupedMemories.length === 0
            ? "auto"
            : `${groupedMemories.length * rowHeight + 40}px`,
      }}
    >
      {loadingMemories ? (
        <div className="space-y-4 py-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-12 h-4 bg-foreground/10 rounded" />
              <div className="relative w-1.5 h-16 bg-foreground/10 flex items-center justify-center">
                <div className="absolute w-4 h-4 rounded-full bg-foreground/20" />
              </div>
              <div className="flex-1 rounded-2xl border border-white/40 bg-white/50 p-4 space-y-1.5">
                <div className="h-4 w-32 bg-foreground/10 rounded" />
                <div className="h-3 w-48 bg-foreground/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : groupedMemories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white/40 rounded-3xl border border-white/20 mt-4">
          <BookHeart size={32} className="text-foreground/20 mb-2" />
          <div className="text-xs font-semibold text-foreground/50">No memories recorded yet</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Capture your first memory together by tapping the floating button!
          </p>
        </div>
      ) : (
        <>
          {/* Connector Path */}
          {points.length > 1 && (
            <svg className="absolute inset-x-5 top-0 bottom-0 w-[calc(100%-2.5rem)] h-full pointer-events-none z-0">
              <defs>
                <filter id="timeline-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d={pathD}
                fill="none"
                stroke="oklch(0.68 0.09 240 / 0.12)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d={pathD}
                fill="none"
                stroke="oklch(0.68 0.09 240 / 0.35)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 8"
                filter="url(#timeline-glow)"
              />
            </svg>
          )}

          {/* Bubbles Grid */}
          <div
            className="relative z-10 grid grid-cols-3"
            style={{ gridAutoRows: `${rowHeight}px` }}
          >
            {groupedMemories.map((group, idx) => {
              const colClass = getColClass(idx);
              const rowStart = idx + 1;
              const formattedDate = group.date ? new Date(group.date + "T00:00:00") : null;

              return (
                <div
                  key={group.date || `mem-${idx}`}
                  id={`bubble-${group.date || ""}`}
                  className={`flex flex-col items-center justify-center ${colClass}`}
                  style={{ height: `${rowHeight}px`, gridRowStart: rowStart }}
                >
                  <div className="flex items-center justify-center -space-x-3.5">
                    {group.memories.map((m, mIdx) => {
                      const isMain = mIdx === 0;
                      const sizeClass = isMain
                        ? "w-20 h-20 z-20"
                        : "w-13 h-13 z-10 opacity-90 hover:opacity-100 hover:scale-105 hover:z-30";

                      const formattedMDate = m.memory_date
                        ? new Date(m.memory_date + "T00:00:00")
                        : null;

                      return (
                        <div key={m.id} className="flex flex-col items-center relative">
                          <button
                            onClick={() => setActiveMemory(m)}
                            className={`group relative rounded-full flex items-center justify-center overflow-hidden border-2 border-white bg-white/20 backdrop-blur-[2px] shadow-[0_6px_20px_-8px_rgba(80,110,160,0.3)] transition-all hover:scale-105 active:scale-95 ${sizeClass}`}
                          >
                            {m.cover_url && (
                              <>
                                <img
                                  src={m.cover_url}
                                  alt=""
                                  loading="lazy"
                                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-white/10 backdrop-blur-[0.5px] transition-opacity group-hover:opacity-10" />
                              </>
                            )}

                            {isMain ? (
                              <div
                                className={`relative z-10 flex flex-col items-center text-foreground ${m.cover_url ? "drop-shadow-[0_1.5px_3.5px_rgba(255,255,255,0.95)]" : ""}`}
                              >
                                {formattedMDate ? (
                                  <>
                                    <span className="text-[8px] uppercase tracking-widest text-foreground/80 font-bold leading-none">
                                      {format(formattedMDate, "MMM")}
                                    </span>
                                    <span className="display text-xl font-bold mt-0.5 leading-none">
                                      {format(formattedMDate, "d")}
                                    </span>
                                    <span className="text-[7px] text-foreground/70 mt-0.5 leading-none">
                                      {format(formattedMDate, "yyyy")}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-wider text-foreground/60 font-semibold">
                                    Special
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div
                                className={`relative z-10 text-foreground/75 ${m.cover_url ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]" : ""}`}
                              >
                                {m.cover_url ? null : <Tag size={12} />}
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    onClick={() => setActiveMemory(group.memories[0])}
                    className="mt-3 px-3 py-1 rounded-full border border-white/60 bg-white/45 backdrop-blur-md shadow-sm text-[10px] font-semibold text-foreground/90 truncate max-w-[120px] cursor-pointer hover:bg-white/65 hover:scale-105 active:scale-95 transition-all text-center"
                    title={group.memories.map((m) => m.title).join(", ")}
                  >
                    {group.memories[0].title}
                    {group.memories.length > 1 && ` (+${group.memories.length - 1})`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="mx-auto max-w-md space-y-4 px-5 py-6 pb-32">
      {/* Calendar section */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="rounded-full p-1.5 hover:bg-black/5"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="display text-lg">{format(cursor, "MMMM yyyy")}</div>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="rounded-full p-1.5 hover:bg-black/5"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-sm">
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const hasEvent = events.some((e) => isSameDay(new Date(e.starts_at), d));
            const dayPhoto = monthPhotos.find(
              (p) => p.dateStr && isSameDay(new Date(p.dateStr + "T00:00:00"), d),
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
                {dayPhoto?.url && inMonth && (
                  <>
                    <img
                      src={dayPhoto.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 rounded-full border border-white/50 bg-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
                  </>
                )}

                {isToday && (
                  <div className="absolute inset-0 rounded-full ring-2 ring-foreground/60 bg-foreground/10" />
                )}

                {!dayPhoto && !isToday && (
                  <div className="absolute inset-0 rounded-full hover:bg-black/5" />
                )}

                <span
                  className={`relative z-10 text-xs font-semibold
                  ${isToday ? "text-foreground" : dayPhoto ? "text-foreground/90" : "text-foreground/70"}`}
                >
                  {d.getDate()}
                </span>

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
        <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Moment list
        </div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Quiet month. Add some moments!</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 border border-white/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(e.starts_at), "EEE, MMM d · h:mm a")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
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

      {/* Collapsible Memories Timeline Section */}
      <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="display text-[16px] font-semibold text-foreground/80">Timeline</h2>
          </div>
          <div className="flex items-center gap-2">
            {isTimelineOpen && (
              <div className="flex items-center gap-1 border border-white/50 bg-white/60 backdrop-blur-md rounded-full px-2 py-0.5 shadow-sm max-w-[140px] md:max-w-[180px]">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveSearchIndex(0);
                  }}
                  className="w-full bg-transparent border-none outline-none text-[10px] text-foreground font-semibold placeholder:text-muted-foreground/60 p-1"
                />
                {matchingDateGroups.length > 0 && (
                  <div className="flex items-center gap-0.5 shrink-0 text-[8px] font-bold text-foreground/50 select-none">
                    <span>
                      {activeSearchIndex + 1}/{matchingDateGroups.length}
                    </span>
                    <button
                      onClick={() =>
                        setActiveSearchIndex(
                          (i) => (i - 1 + matchingDateGroups.length) % matchingDateGroups.length,
                        )
                      }
                      className="p-0.5 hover:bg-black/5 rounded text-foreground/75"
                    >
                      <ChevronLeft size={9} />
                    </button>
                    <button
                      onClick={() =>
                        setActiveSearchIndex((i) => (i + 1) % matchingDateGroups.length)
                      }
                      className="p-0.5 hover:bg-black/5 rounded text-foreground/75"
                    >
                      <ChevronRight size={9} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsFullscreenTimeline(true)}
              className="p-1 rounded-full hover:bg-black/5 text-foreground/60 transition-colors"
              title="Full screen view"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              className="p-1 rounded-full hover:bg-black/5 text-foreground/60 transition-colors"
              title={isTimelineOpen ? "Hide Timeline" : "Show Timeline"}
            >
              {isTimelineOpen ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
            </button>
          </div>
        </div>

        {isTimelineOpen && renderTimeline()}
      </section>

      {/* Consistent Stacked Floating Action Buttons at bottom right */}
      <div className="fixed bottom-24 right-5 z-40 flex flex-col gap-2.5 items-end justify-end pointer-events-none">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.button
              key="collapsed-add-trigger"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsExpanded(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/50 bg-primary text-white px-5 py-3 text-sm shadow-[0_15px_30px_-5px_rgba(80,110,160,0.5),0_4px_12px_rgba(0,0,0,0.12)] hover:bg-primary/95 active:scale-95 transition-all font-semibold"
            >
              <Plus size={16} /> Add
            </motion.button>
          ) : (
            <div className="flex flex-col gap-2.5 items-end">
              <motion.button
                key="add-moment-btn"
                initial={{ opacity: 0, y: 15, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.8 }}
                onClick={() => {
                  openSheet("add-event");
                  setIsExpanded(false);
                }}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/50 bg-white/80 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_15px_30px_-5px_rgba(80,110,160,0.45),0_4px_12px_rgba(0,0,0,0.1)] hover:bg-white/90 active:scale-95 transition-all font-semibold"
              >
                <Plus size={16} /> Add Moment
              </motion.button>
              <motion.button
                key="add-memory-btn"
                initial={{ opacity: 0, y: 15, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.8 }}
                onClick={() => {
                  openSheet("add-memory");
                  setIsExpanded(false);
                }}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/50 bg-white/80 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_15px_30px_-5px_rgba(80,110,160,0.45),0_4px_12px_rgba(0,0,0,0.1)] hover:bg-white/90 active:scale-95 transition-all font-semibold"
              >
                <Plus size={16} /> Add Memory
              </motion.button>
              <motion.button
                key="close-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setIsExpanded(false)}
                className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-4 py-2 text-xs text-foreground/60 hover:text-foreground active:scale-95 transition-all shadow-md"
              >
                <X size={12} /> Cancel
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>

      <LongPressModal
        isOpen={showLongPressInfo}
        onClose={() => setShowLongPressInfo(false)}
        title="Love Timeline & Moments"
        description="Here you can keep track of moments you look forward to and scroll through our sweet milestones line of memories. Tap 'Add Moment' to schedule a date or 'Add Memory' to capture a timeline bubble."
      />

      {/* Full Screen Timeline Modal Overlay */}
      {isFullscreenTimeline && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto flex flex-col p-5 pb-32 animate-in fade-in duration-200">
          <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-6">
              <div className="flex items-center gap-2">
                <h2 className="display text-xl font-bold text-foreground">Timeline</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border border-white/50 bg-white/60 backdrop-blur-md rounded-full px-2 py-0.5 shadow-sm max-w-[140px] md:max-w-[180px]">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setActiveSearchIndex(0);
                    }}
                    className="w-full bg-transparent border-none outline-none text-[10px] text-foreground font-semibold placeholder:text-muted-foreground/60 p-1"
                  />
                  {matchingDateGroups.length > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0 text-[8px] font-bold text-foreground/50 select-none">
                      <span>
                        {activeSearchIndex + 1}/{matchingDateGroups.length}
                      </span>
                      <button
                        onClick={() =>
                          setActiveSearchIndex(
                            (i) => (i - 1 + matchingDateGroups.length) % matchingDateGroups.length,
                          )
                        }
                        className="p-0.5 hover:bg-black/5 rounded text-foreground/75"
                      >
                        <ChevronLeft size={9} />
                      </button>
                      <button
                        onClick={() =>
                          setActiveSearchIndex((i) => (i + 1) % matchingDateGroups.length)
                        }
                        className="p-0.5 hover:bg-black/5 rounded text-foreground/75"
                      >
                        <ChevronRight size={9} />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsFullscreenTimeline(false)}
                  className="p-1.5 rounded-full bg-white/60 border border-white/50 text-foreground/60 hover:text-foreground transition-all shadow-sm"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {/* Render full screen bubbles */}
            <div
              className="relative w-full flex-1"
              style={{ minHeight: `${groupedMemories.length * rowHeight + 100}px` }}
            >
              {points.length > 1 && (
                <svg className="absolute inset-x-5 top-0 bottom-0 w-[calc(100%-2.5rem)] h-full pointer-events-none z-0">
                  <path
                    d={pathD}
                    fill="none"
                    stroke="oklch(0.68 0.09 240 / 0.12)"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="oklch(0.68 0.09 240 / 0.35)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="8 8"
                  />
                </svg>
              )}

              <div
                className="relative z-10 grid grid-cols-3"
                style={{ gridAutoRows: `${rowHeight}px` }}
              >
                {groupedMemories.map((group, idx) => {
                  const colClass = getColClass(idx);
                  const rowStart = idx + 1;
                  const formattedDate = group.date ? new Date(group.date + "T00:00:00") : null;

                  return (
                    <div
                      key={group.date || `fs-mem-${idx}`}
                      id={`fullscreen-bubble-${group.date || ""}`}
                      className={`flex flex-col items-center justify-center ${colClass}`}
                      style={{ height: `${rowHeight}px`, gridRowStart: rowStart }}
                    >
                      <div className="flex items-center justify-center -space-x-3.5">
                        {group.memories.map((m, mIdx) => {
                          const isMain = mIdx === 0;
                          const sizeClass = isMain ? "w-20 h-20 z-20" : "w-13 h-13 z-10";
                          const formattedMDate = m.memory_date
                            ? new Date(m.memory_date + "T00:00:00")
                            : null;

                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setIsFullscreenTimeline(false);
                                setActiveMemory(m);
                              }}
                              className={`group relative rounded-full flex items-center justify-center overflow-hidden border-2 border-white bg-white/20 backdrop-blur-[2px] shadow-md transition-all hover:scale-105 ${sizeClass}`}
                            >
                              {m.cover_url && (
                                <img
                                  src={m.cover_url}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              )}
                              {isMain ? (
                                <div className="relative z-10 flex flex-col items-center text-foreground font-bold">
                                  {formattedMDate ? (
                                    <>
                                      <span className="text-[8px] uppercase">
                                        {format(formattedMDate, "MMM")}
                                      </span>
                                      <span className="text-xl leading-none mt-0.5">
                                        {format(formattedMDate, "d")}
                                      </span>
                                      <span className="text-[7px] opacity-70 mt-0.5">
                                        {format(formattedMDate, "yyyy")}
                                      </span>
                                    </>
                                  ) : (
                                    "Special"
                                  )}
                                </div>
                              ) : (
                                <Tag size={12} className="relative z-10 text-foreground/75" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div
                        onClick={() => {
                          setIsFullscreenTimeline(false);
                          setActiveMemory(group.memories[0]);
                        }}
                        className="mt-3 px-3 py-1 rounded-full border border-white/60 bg-white/45 backdrop-blur-md text-[10px] font-semibold text-foreground/90 truncate max-w-[120px] cursor-pointer text-center"
                      >
                        {group.memories[0].title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Details Dialog Overlay */}
      {activeMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[4px]">
          <div className="relative w-full max-w-sm rounded-3xl border border-white/50 bg-white/70 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                confirm({
                  title: "Delete memory?",
                  message: `Are you sure you want to delete the memory "${activeMemory.title}" kept forever?`,
                  onConfirm: () => deleteMemory.mutate(activeMemory.id),
                });
              }}
              className="absolute right-14 top-4 z-20 rounded-full bg-red-50/90 border border-red-200/50 p-1.5 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Delete memory"
              disabled={deleteMemory.isPending}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setActiveMemory(null)}
              className="absolute right-4 top-4 z-20 rounded-full bg-white/80 p-1.5 text-foreground/60 hover:text-foreground hover:bg-white border border-white/50 transition-colors shadow-sm"
            >
              <X size={16} />
            </button>

            {activeMemory.cover_url && (
              <div
                className="relative h-48 w-full overflow-hidden cursor-pointer"
                onClick={() => setLightbox(activeMemory.cover_url)}
              >
                <img src={activeMemory.cover_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
              </div>
            )}

            <div className="p-6 pt-5 space-y-4">
              <div className="space-y-1">
                <h3 className="display text-2xl text-foreground font-semibold leading-snug">
                  {activeMemory.title}
                </h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
                  {activeMemory.memory_date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} />{" "}
                      {format(new Date(activeMemory.memory_date + "T00:00:00"), "MMMM d, yyyy")}
                    </span>
                  )}
                  {activeMemory.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {activeMemory.location}
                    </span>
                  )}
                </div>
              </div>

              {activeMemory.description ? (
                <div className="text-sm text-foreground/80 leading-relaxed max-h-48 overflow-y-auto pr-1">
                  {activeMemory.description}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No description added to this memory.
                </p>
              )}

              {activeMemory.cover_url && (
                <button
                  onClick={() => setLightbox(activeMemory.cover_url)}
                  className="w-full py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-xs font-semibold text-foreground/80 transition-all text-center shadow-sm"
                >
                  View Full Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
