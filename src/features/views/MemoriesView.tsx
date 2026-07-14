import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, X, MapPin, Tag, Calendar as CalIcon } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { Lightbox } from "@/lib/Lightbox";

type Memory = {
  id: string;
  title: string;
  description: string | null;
  memory_date: string | null;
  category: string;
  location: string | null;
  cover_url: string | null;
};

export function MemoriesView({ relationshipId }: { relationshipId: string }) {
  const { openSheet } = useAppStore();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  
  // Track container width for responsive SVG drawing
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(360);

  const { data: memories = [] } = useQuery({
    queryKey: ["memories", relationshipId],
    queryFn: async () =>
      ((await supabase
        .from("memories")
        .select("id,title,description,memory_date,category,location,cover_url")
        .eq("relationship_id", relationshipId)
        .order("memory_date", { ascending: false })
        .limit(100)
      ).data ?? []) as Memory[],
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // Subtract horizontal padding (px-5 = 40px) to get exact SVG width
        setContainerWidth(entries[0].contentRect.width - 40);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const rowHeight = 180;
  const cx_0 = containerWidth / 6;
  const cx_1 = containerWidth / 2;
  const cx_2 = (containerWidth * 5) / 6;

  // Calculate coordinates for SVG curve
  const points = memories.map((_, i) => {
    const rem = i % 4;
    let x = cx_1;
    if (rem === 0) x = cx_0;
    else if (rem === 2) x = cx_2;
    return { x, y: i * rowHeight + 80 }; // 80 is center of the bubble in cell
  });

  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cp1y = prev.y + rowHeight / 2;
      const cp2y = curr.y - rowHeight / 2;
      pathD += ` C ${prev.x} ${cp1y}, ${curr.x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
  }

  const getColClass = (idx: number) => {
    const rem = idx % 4;
    if (rem === 0) return "col-start-1 justify-self-center";
    if (rem === 1 || rem === 3) return "col-start-2 justify-self-center";
    return "col-start-3 justify-self-center";
  };

  return (
    <div ref={containerRef} className="relative mx-auto max-w-md px-5 py-8 pb-32 min-h-screen">
      {memories.length === 0 ? (
        <div className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-8 text-center relative z-10">
          <div className="display text-xl">Nothing kept yet.</div>
          <p className="mt-2 text-sm text-muted-foreground">The first memory is always the sweetest.</p>
        </div>
      ) : (
        <>
          {/* Snaking S-Path SVG Connector */}
          {points.length > 1 && (
            <svg className="absolute inset-x-5 top-0 bottom-0 w-[calc(100%-2.5rem)] h-full pointer-events-none z-0">
              {/* Glow filter */}
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d={pathD}
                fill="none"
                stroke="oklch(0.68 0.09 240 / 0.15)"
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
                filter="url(#glow)"
              />
            </svg>
          )}

          {/* Grid of Bubbles */}
          <div className="relative z-10 grid grid-cols-3 gap-y-12">
            {memories.map((m, idx) => {
              const formattedDate = m.memory_date ? new Date(m.memory_date + "T00:00:00") : null;
              const colClass = getColClass(idx);

              return (
                <div
                  key={m.id}
                  className={`flex flex-col items-center select-none ${colClass}`}
                  style={{ height: `${rowHeight}px` }}
                >
                  {/* Bubble Container */}
                  <button
                    onClick={() => setActiveMemory(m)}
                    className="group relative w-22 h-22 md:w-25 md:h-25 rounded-full flex items-center justify-center overflow-hidden border-2 border-white bg-white/20 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),0_8px_24px_-8px_rgba(80,110,160,0.4)] transition-all hover:scale-105 active:scale-95"
                  >
                    {/* Cover Photo Background */}
                    {m.cover_url && (
                      <>
                        <img
                          src={m.cover_url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        {/* Glossy overlay with subtle white shine, no heavy blur */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),rgba(0,0,0,0.1))] transition-opacity group-hover:opacity-60" />
                      </>
                    )}

                    {/* Date Display */}
                    <div className={`relative z-10 flex flex-col items-center text-foreground ${m.cover_url ? "bg-white/50 backdrop-blur-[2px] px-2.5 py-1.5 rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : ""}`}>
                      {formattedDate ? (
                        <>
                          <span className="text-[9px] uppercase tracking-widest text-foreground/70 font-semibold leading-none">
                            {format(formattedDate, "MMM")}
                          </span>
                          <span className="display text-2xl font-bold mt-0.5 leading-none drop-shadow-sm">
                            {format(formattedDate, "d")}
                          </span>
                          <span className="text-[8px] text-foreground/50 mt-0.5 leading-none">
                            {format(formattedDate, "yyyy")}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-foreground/60 font-semibold">
                          Special
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Glass Nameplate */}
                  <div
                    onClick={() => setActiveMemory(m)}
                    className="mt-3.5 px-3 py-1.5 rounded-full border border-white/60 bg-white/45 backdrop-blur-md shadow-[0_4px_12px_-4px_rgba(80,110,160,0.25)] text-[11px] font-semibold text-foreground/90 truncate max-w-[110px] cursor-pointer hover:bg-white/65 hover:scale-105 active:scale-95 transition-all text-center"
                    title={m.title}
                  >
                    {m.title}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Floating Add Memory Button */}
      <button
        onClick={() => openSheet("add-memory")}
        className="fixed bottom-24 right-5 z-20 flex items-center gap-2 rounded-full border border-white/50 bg-white/70 backdrop-blur-2xl px-5 py-3 text-sm shadow-[0_10px_30px_-10px_rgba(80,110,160,0.4)] hover:bg-white/80 active:scale-95 transition-all"
      >
        <Plus size={16} /> New memory
      </button>

      {/* Full Story/Details Dialog Overlay */}
      {activeMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-[4px]">
          {/* Modal Card */}
          <div className="relative w-full max-w-sm rounded-3xl border border-white/50 bg-white/70 backdrop-blur-2xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button
              onClick={() => setActiveMemory(null)}
              className="absolute right-4 top-4 z-20 rounded-full bg-white/80 p-1.5 text-foreground/60 hover:text-foreground hover:bg-white border border-white/50 transition-colors shadow-sm"
            >
              <X size={16} />
            </button>

            {/* Cover Image */}
            {activeMemory.cover_url && (
              <div className="relative h-48 w-full overflow-hidden cursor-pointer" onClick={() => setLightbox(activeMemory.cover_url)}>
                <img src={activeMemory.cover_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
              </div>
            )}

            {/* Content Details */}
            <div className="p-6 pt-5 space-y-4">
              <div className="space-y-1">
                {/* Category tag */}
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary font-bold">
                  <Tag size={10} /> {activeMemory.category}
                </div>
                
                {/* Title */}
                <h3 className="display text-2xl text-foreground font-semibold leading-snug">
                  {activeMemory.title}
                </h3>

                {/* Date & Location */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
                  {activeMemory.memory_date && (
                    <span className="flex items-center gap-1">
                      <CalIcon size={12} /> {format(new Date(activeMemory.memory_date + "T00:00:00"), "MMMM d, yyyy")}
                    </span>
                  )}
                  {activeMemory.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {activeMemory.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Story Description */}
              {activeMemory.description ? (
                <div className="text-sm text-foreground/80 leading-relaxed max-h-48 overflow-y-auto pr-1">
                  {activeMemory.description}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No description added to this memory.</p>
              )}

              {/* Open Lightbox shortcut if image exists */}
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
