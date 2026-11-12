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
import { useState, useEffect, useMemo } from "react";
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
  Eye,
  EyeOff,
  Play,
} from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { toast } from "sonner";
import { LongPressModal } from "@/components/ui/LongPressModal";
import { LevelPath, LEVEL_ROW } from "./LevelPath";
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
  tags?: string[] | null;
  created_at: string;
};

export const isWrappedMemory = (m?: Memory | null) => {
  if (!m) return false;
  return (
    m.tags?.includes("wrapped") ||
    m.tags?.includes("monthsary") ||
    m.category === "wrapped" ||
    m.title?.toLowerCase().includes("3rd monthsary") ||
    m.title?.toLowerCase().includes("monthsary wrapped")
  );
};

// Most avatars shown per timeline day before collapsing the rest into a "+N" pill.
const MAX_AVATARS = 3;

export function CalendarView({ relationshipId }: { relationshipId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const { openSheet, confirm, openMonthsary } = useAppStore();
  const [showLongPressInfo, setShowLongPressInfo] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isFullscreenTimeline, setIsFullscreenTimeline] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  useEffect(() => {
    const key = "intro-dismissed-calendar";
    const val = localStorage.getItem(key);
    if (!val) {
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
      qc.invalidateQueries({ queryKey: ["photos-cal"] });
      qc.invalidateQueries({ queryKey: ["photos-cal-home"] });
      qc.invalidateQueries({ queryKey: ["stats", relationshipId] });
      setActiveMemory(null);
    },
    onError: (e: any) => toast.error(e?.message || String(e)),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", relationshipId, cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const s = startOfMonth(cursor).toISOString();
      const e = endOfMonth(cursor).toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("relationship_id", relationshipId)
        .gte("starts_at", s)
        .lte("starts_at", e)
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: memories = [], isLoading: loadingMemories } = useQuery({
    queryKey: ["memories", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id,title,description,memory_date,category,location,cover_url,tags,created_at")
        .eq("relationship_id", relationshipId)
        .order("memory_date", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Memory[];
    },
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
          // Photo notes are stored as kind "note" with an image_url, so filter on the image.
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

  const rowHeight = LEVEL_ROW;

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
        const highlight = ["ring-4", "ring-primary", "ring-offset-2", "scale-105"];
        const timer = setTimeout(() => {
          el.classList.remove(...highlight);
        }, 2000);
        return () => {
          clearTimeout(timer);
          el.classList.remove(...highlight);
        };
      }
    }
  }, [activeSearchIndex, searchQuery, isFullscreenTimeline, matchingDateGroups]);

  const getColClass = (idx: number) => {
    const rem = idx % 4;
    if (rem === 0) return "col-start-1 justify-self-center";
    if (rem === 1 || rem === 3) return "col-start-2 justify-self-center";
    return "col-start-3 justify-self-center";
  };

  // Search result stepper, on its own row so the 40px buttons don't squeeze the header.
  const renderSearchNav = () =>
    matchingDateGroups.length > 0 ? (
      <div className="mt-3 flex items-center justify-end gap-2 select-none">
        <span className="text-[13px] font-semibold text-sn-muted tabular-nums">
          {activeSearchIndex + 1} of {matchingDateGroups.length}
        </span>
        <button
          onClick={() =>
            setActiveSearchIndex(
              (i) => (i - 1 + matchingDateGroups.length) % matchingDateGroups.length,
            )
          }
          className="sn-pill sn-icon-btn h-10 w-10"
          aria-label="Previous search result"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setActiveSearchIndex((i) => (i + 1) % matchingDateGroups.length)}
          className="sn-pill sn-icon-btn h-10 w-10"
          aria-label="Next search result"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    ) : null;

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
        <div className="mt-4 flex flex-col items-center justify-center px-6 pb-8 pt-4 text-center">
          <img src="/lily2.webp" alt="" aria-hidden className="w-[132px] -rotate-12 select-none" />
          <div className="mt-2 font-serif text-[21px] font-semibold text-sn-navy">
            The first page is still blank
          </div>
          <p className="mt-1.5 max-w-[320px] text-[14.5px] leading-relaxed text-sn-muted">
            Add a memory and it will bloom here, kept by the day it happened.
          </p>
        </div>
      ) : (
        <>
          <LevelPath count={groupedMemories.length} />

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
                  className={`flex flex-col items-center justify-start pt-[30px] ${colClass}`}
                  style={{ height: `${rowHeight}px`, gridRowStart: rowStart }}
                >
                  <div className="flex items-center justify-center -space-x-3.5">
                    {group.memories.slice(0, MAX_AVATARS).map((m, mIdx) => {
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
                            onClick={() => {
                              if (isWrappedMemory(m)) {
                                openMonthsary();
                              } else {
                                setActiveMemory(m);
                              }
                            }}
                            className={`group relative rounded-full flex items-center justify-center overflow-hidden border-[3px] border-white bg-[#f4f6fe] shadow-[0_6px_20px_-8px_rgba(80,110,160,0.3)] transition-all hover:scale-105 active:scale-95 ${sizeClass} ${
                              isWrappedMemory(m)
                                ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-white/60 shadow-[0_0_18px_rgba(14,165,233,0.35)]"
                                : ""
                            }`}
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
                                    <span className="text-[12px] uppercase tracking-wider text-foreground/80 font-bold leading-none">
                                      {format(formattedMDate, "MMM")}
                                    </span>
                                    <span className="display text-xl font-bold mt-0.5 leading-none">
                                      {format(formattedMDate, "d")}
                                    </span>
                                    <span className="text-[12px] text-foreground/70 mt-0.5 leading-none">
                                      {format(formattedMDate, "yyyy")}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[12px] uppercase tracking-wider text-foreground/60 font-semibold">
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

                            {isWrappedMemory(m) && (
                              <div className="absolute bottom-1 right-1 z-20 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md border border-white/80">
                                <Play size={8} fill="currentColor" className="ml-0.5" />
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                    {group.memories.length > MAX_AVATARS && (
                      <span className="relative z-30 grid h-9 min-w-9 place-items-center rounded-full border-2 border-white bg-white/85 px-1.5 text-[12px] font-bold text-sn-navy shadow-sm tabular-nums">
                        +{group.memories.length - MAX_AVATARS}
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => setActiveMemory(group.memories[0])}
                    className="mt-3 px-3 py-1 rounded-full border border-white/60 bg-white/45 backdrop-blur-md shadow-sm text-[12px] font-semibold text-foreground/90 truncate max-w-[120px] cursor-pointer hover:bg-white/65 hover:scale-105 active:scale-95 transition-all text-center"
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
    <div className="mx-auto max-w-[640px] space-y-[18px] px-4 pb-44 pt-5 sm:px-6 lg:grid lg:max-w-[1186px] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-[18px] lg:space-y-0">
      {/* Calendar section */}
      <section className="sn-glass p-5 sm:p-6 lg:col-start-1">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="grid h-[42px] w-[42px] place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-navy shadow-[var(--shadow-pill)] active:scale-95 touch-manipulation"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="font-serif text-[24px] font-semibold text-sn-navy">{format(cursor, "MMMM yyyy")}</div>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="grid h-[42px] w-[42px] place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-navy shadow-[var(--shadow-pill)] active:scale-95 touch-manipulation"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[13px] font-semibold text-sn-ink">
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
                className={`relative aspect-square flex items-center justify-center rounded-full transition-transform ${dayPhoto && !isToday ? "overflow-hidden" : ""}
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
                  <img src="/art/clay-heart.png" alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[130%] w-[130%] max-w-none -translate-x-1/2 -translate-y-[46%] select-none drop-shadow-[0_4px_8px_rgba(236,122,164,0.35)]" />
                )}

                {!dayPhoto && !isToday && (
                  <div className="absolute inset-0 rounded-full hover:bg-black/5" />
                )}

                <span
                  className={`relative z-10 text-[14px] font-semibold tabular-nums
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
      <section className="sn-glass p-5 sm:p-6 lg:col-start-1">
        <h2 className="sn-label mb-4">Moment list</h2>
        {events.length === 0 ? (
          <div className="text-[15px] text-sn-muted">No moments this month</div>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-[18px] border border-white/90 bg-white/70 px-4 py-3 shadow-[var(--shadow-pill)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-[17px] font-semibold text-sn-navy">{e.title}</div>
                  <div className="text-[12px] text-muted-foreground">
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
                    className="sn-pill sn-icon-btn h-10 w-10"
                    title="Delete event"
                    aria-label={`Delete ${e.title}`}
                  >
                    <Trash2 size={15} className="!text-[#c2416c]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Collapsible Memories Timeline Section */}
      <section className="sn-glass relative overflow-hidden p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="sn-label">Timeline</h2>
          </div>
          <div className="flex items-center gap-2">
            {isTimelineOpen && (
              <div className="flex items-center gap-1 border border-white/50 bg-white/60 backdrop-blur-md rounded-full px-2 py-0.5 shadow-sm max-w-[140px] md:max-w-[180px]">
                <input
                  type="text"
                  placeholder="Search..."
                  aria-label="Search the timeline"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActiveSearchIndex(0);
                  }}
                  className="w-full bg-transparent border-none outline-none text-[16px] text-foreground font-semibold placeholder:text-muted-foreground/60 p-1"
                />
              </div>
            )}

            <button
              onClick={() => setIsFullscreenTimeline(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-foreground/60 active:scale-90 transition-all touch-manipulation"
              title="Full screen view"
              aria-label="Full screen view"
            >
              <Maximize2 size={15} />
            </button>
            <button
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 text-foreground/60 active:scale-90 transition-all touch-manipulation"
              title={isTimelineOpen ? "Hide Timeline" : "Show Timeline"}
              aria-label={isTimelineOpen ? "Hide Timeline" : "Show Timeline"}
            >
              {isTimelineOpen ? <Eye size={15} /> : <EyeOff size={15} className="opacity-50" />}
            </button>
          </div>
        </div>

        {isTimelineOpen && renderSearchNav()}
        {isTimelineOpen && renderTimeline()}
      </section>

      {/* Consistent Stacked Floating Action Buttons at bottom right */}
      <div className="sn-fab-dock flex flex-col-reverse gap-2.5 items-end justify-end pointer-events-none lg:items-start">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.button
              key="collapsed-add-trigger"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsExpanded(true)}
              className="pointer-events-auto sn-pill h-12 px-5 text-[15px] shadow-[0_14px_30px_-12px_rgba(60,90,200,0.7)]"
            >
              <Plus size={16} /> Add
            </motion.button>
          ) : (
            <div className="flex flex-col gap-2.5 items-end lg:items-start">
              <motion.button
                key="add-moment-btn"
                initial={{ opacity: 0, y: 15, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.8 }}
                onClick={() => {
                  openSheet("add-event");
                  setIsExpanded(false);
                }}
                className="pointer-events-auto sn-pill h-12 px-5 text-[15px] shadow-[0_14px_30px_-12px_rgba(60,90,200,0.7)]"
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
                className="pointer-events-auto sn-pill h-12 px-5 text-[15px] shadow-[0_14px_30px_-12px_rgba(60,90,200,0.7)]"
              >
                <Plus size={16} /> Add Memory
              </motion.button>
              <motion.button
                key="close-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setIsExpanded(false)}
                className="pointer-events-auto sn-ghost h-10 px-4 text-[14px]"
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
                    aria-label="Search the timeline"
                    className="w-full bg-transparent border-none outline-none text-[16px] text-foreground font-semibold placeholder:text-muted-foreground/60 p-1"
                  />
                </div>
                <button
                  onClick={() => setIsFullscreenTimeline(false)}
                  className="sn-pill sn-icon-btn h-10 w-10"
                  aria-label="Exit fullscreen"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>
            {matchingDateGroups.length > 0 && <div className="-mt-3 mb-4">{renderSearchNav()}</div>}

            {/* Render full screen bubbles */}
            <div
              className="relative w-full flex-1"
              style={{ minHeight: `${groupedMemories.length * rowHeight + 100}px` }}
            >
              <LevelPath count={groupedMemories.length} />

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
                      className={`flex flex-col items-center justify-start pt-[30px] ${colClass}`}
                      style={{ height: `${rowHeight}px`, gridRowStart: rowStart }}
                    >
                      <div className="flex items-center justify-center -space-x-3.5">
                        {group.memories.slice(0, MAX_AVATARS).map((m, mIdx) => {
                          const isMain = mIdx === 0;
                          const sizeClass = isMain ? "w-20 h-20 z-20" : "w-13 h-13 z-10";
                          const formattedMDate = m.memory_date
                            ? new Date(m.memory_date + "T00:00:00")
                            : null;

                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (isWrappedMemory(m)) {
                                  setIsFullscreenTimeline(false);
                                  openMonthsary();
                                } else {
                                  setIsFullscreenTimeline(false);
                                  setActiveMemory(m);
                                }
                              }}
                              className={`group relative rounded-full flex items-center justify-center overflow-hidden border-[3px] border-white bg-[#f4f6fe] shadow-md transition-all hover:scale-105 ${sizeClass} ${
                                isWrappedMemory(m)
                                  ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-white/60 shadow-[0_0_18px_rgba(14,165,233,0.35)]"
                                  : ""
                              }`}
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
                                      <span className="text-[12px] uppercase">
                                        {format(formattedMDate, "MMM")}
                                      </span>
                                      <span className="text-xl leading-none mt-0.5">
                                        {format(formattedMDate, "d")}
                                      </span>
                                      <span className="text-[12px] opacity-70 mt-0.5">
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

                              {isWrappedMemory(m) && (
                                <div className="absolute bottom-1 right-1 z-20 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md border border-white/80">
                                  <Play size={8} fill="currentColor" className="ml-0.5" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                        {group.memories.length > MAX_AVATARS && (
                          <span className="relative z-30 grid h-9 min-w-9 place-items-center rounded-full border-2 border-white bg-white/85 px-1.5 text-[12px] font-bold text-sn-navy shadow-sm tabular-nums">
                            +{group.memories.length - MAX_AVATARS}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => {
                          setIsFullscreenTimeline(false);
                          setActiveMemory(group.memories[0]);
                        }}
                        className="mt-3 px-3 py-1 rounded-full border border-white/60 bg-white/45 backdrop-blur-md text-[12px] font-semibold text-foreground/90 truncate max-w-[120px] cursor-pointer text-center"
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
          <div className="relative w-full max-w-sm sn-card shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                confirm({
                  title: "Delete memory?",
                  message: `Are you sure you want to delete the memory "${activeMemory.title}" kept forever?`,
                  onConfirm: () => deleteMemory.mutate(activeMemory.id),
                });
              }}
              className="sn-pill sn-icon-btn absolute right-16 top-4 z-20 h-10 w-10"
              title="Delete memory"
              aria-label="Delete memory"
              disabled={deleteMemory.isPending}
            >
              <Trash2 size={16} className="!text-[#c2416c]" />
            </button>
            <button
              onClick={() => setActiveMemory(null)}
              className="sn-pill sn-icon-btn absolute right-4 top-4 z-20 h-10 w-10"
              aria-label="Close"
              title="Close"
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

              {/* Play Wrapped Story button */}
              {isWrappedMemory(activeMemory) && (
                <button
                  onClick={() => {
                    setActiveMemory(null);
                    openMonthsary();
                  }}
                  className="sn-pill w-full h-12 text-[15px]"
                >
                  <Play size={13} fill="currentColor" />
                  Play monthsary story
                </button>
              )}

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
                  className="sn-ghost h-11 w-full text-[14px]"
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
