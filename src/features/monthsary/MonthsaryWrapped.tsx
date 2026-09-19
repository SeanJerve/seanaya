import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/features/app/store";
import {
  X,
  Heart,
  RotateCcw,
  ChevronRight,
  Camera,
  Layers,
} from "lucide-react";

type Pet = {
  id: string;
  name: string;
  species: string;
  photos: string[];
  created_at: string;
};

type Memory = {
  id: string;
  title: string;
  cover_url: string | null;
  memory_date: string | null;
  description: string | null;
};

type StickerItem = {
  id: string;
  image_url: string;
};

type NoteItem = {
  id: string;
  body: string;
  image_url: string | null;
};

const TOTAL_SLIDES = 6;
const SLIDE_DURATION_MS = 7500;

const STICKER_SOURCES = [
  "/stickers/sticker_0_dbf609.png",
  "/stickers/sticker_1_25567c.png",
  "/stickers/sticker_2_fb4f58.png",
  "/stickers/sticker_3_311950.png",
  "/stickers/sticker_4_8591e5.png",
  "/stickers/sticker_5_6523c4.png",
  "/stickers/sticker_6_b7873e.png",
  "/stickers/sticker_7_b6c6c2.png",
  "/stickers/sticker_8_5c6d55.png",
];

const PRELOADED_STICKER_IMAGES: HTMLImageElement[] =
  typeof window !== "undefined"
    ? STICKER_SOURCES.map((src) => {
        const img = new Image();
        img.src = src;
        return img;
      })
    : [];

if (typeof window !== "undefined") {
  const coupleImg = new Image();
  coupleImg.src = "/couple-sticker.png";
}


const sentenceVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const letterVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.85 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      damping: 12,
      stiffness: 160,
    },
  },
};

function AmbientBlobs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        animate={{
          x: [0, 20, 0],
          y: [0, -15, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/50 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -25, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-sky-200/60 blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.06, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-sky-100/50 blur-2xl"
      />
    </div>
  );
}

function BackgroundSparkles() {
  const sparkles = [
    { top: "12%", left: "15%", delay: 0.5, scale: 0.6 },
    { top: "25%", left: "80%", delay: 1.2, scale: 0.8 },
    { top: "15%", left: "60%", delay: 0.2, scale: 0.5 },
    { top: "45%", left: "10%", delay: 1.8, scale: 0.7 },
    { top: "60%", left: "85%", delay: 0.9, scale: 0.6 },
    { top: "75%", left: "20%", delay: 1.4, scale: 0.5 },
    { top: "80%", left: "70%", delay: 0.3, scale: 0.8 },
    { top: "35%", left: "90%", delay: 2.1, scale: 0.4 },
    { top: "50%", left: "40%", delay: 0.7, scale: 0.6 },
    { top: "90%", left: "30%", delay: 1.5, scale: 0.7 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {sparkles.map((s, idx) => (
        <motion.svg
          key={idx}
          animate={{
            opacity: [0.15, 0.6, 0.15],
            scale: [s.scale * 0.8, s.scale * 1.2, s.scale * 0.8],
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.delay,
          }}
          style={{ top: s.top, left: s.left }}
          className="absolute w-4 h-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
        </motion.svg>
      ))}
    </div>
  );
}

export function MonthsaryWrapped({ relationshipId }: { relationshipId: string }) {
  const { isMonthsaryOpen, closeMonthsary } = useAppStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [slideProgress, setSlideProgress] = useState(0);

  // Fetch real data for Sean and Aya
  const { data: stats } = useQuery({
    queryKey: ["wrapped-stats", relationshipId],
    enabled: isMonthsaryOpen,
    queryFn: async () => {
      const [notesRes, stickersRes, petsRes, memoriesRes, hugsRes] = await Promise.all([
        supabase
          .from("notes")
          .select("id,body,image_url,created_at")
          .eq("relationship_id", relationshipId)
          .order("created_at", { ascending: false }),
        supabase
          .from("stickers")
          .select("id,image_url,created_at")
          .eq("relationship_id", relationshipId)
          .order("created_at", { ascending: false }),
        supabase
          .from("pets")
          .select("id,name,species,photos,created_at")
          .eq("relationship_id", relationshipId)
          .order("created_at", { ascending: true }),
        supabase
          .from("memories")
          .select("id,title,cover_url,memory_date,description")
          .eq("relationship_id", relationshipId)
          .order("memory_date", { ascending: true }),
        supabase
          .from("hugs")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", relationshipId),
      ]);

      return {
        notes: (notesRes.data as NoteItem[]) || [],
        stickers: (stickersRes.data as StickerItem[]) || [],
        pets: (petsRes.data as Pet[]) || [],
        memories: (memoriesRes.data as Memory[]) || [],
        hugsCount: hugsRes.count || 35,
      };
    },
  });

  // Calculate days together since June 19, 2026
  const daysTogether = useMemo(() => {
    const start = new Date("2026-06-19T00:00:00");
    const now = new Date();
    const diff = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return diff > 0 ? diff : 92;
  }, []);

  // Ensure all 9 stickers are always available and rendered on the board
  const displayStickers = useMemo(() => {
    const list = stats?.stickers && stats.stickers.length > 0 ? stats.stickers : [];
    if (list.length >= 9) return list;

    const set = new Set(list.map((s) => s.image_url));
    const filler = STICKER_SOURCES.filter((src) => !set.has(src)).map((src, i) => ({
      id: `fallback-stk-${i}`,
      image_url: src,
    }));
    return [...list, ...filler].slice(0, 9);
  }, [stats?.stickers]);

  // Lily Popper physics on canvas
  const fireLilyPoppers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;


    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      scale: number;
      opacity: number;
      imgIdx: number;
      delay: number;
    }[] = [];

    // Left popper (40 lilies)
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: -5 + Math.random() * 12,
        y: 100,
        vx: 0.4 + Math.random() * 1.1,
        vy: -1.8 - Math.random() * 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: -2.5 + Math.random() * 5,
        scale: 0.45 + Math.random() * 0.4,
        opacity: 1,
        imgIdx: Math.floor(Math.random() * PRELOADED_STICKER_IMAGES.length),
        delay: Math.random() * 85,
      });
    }

    // Right popper (40 lilies)
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: 93 + Math.random() * 12,
        y: 100,
        vx: -0.4 - Math.random() * 1.1,
        vy: -1.8 - Math.random() * 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: -2.5 + Math.random() * 5,
        scale: 0.45 + Math.random() * 0.4,
        opacity: 1,
        imgIdx: Math.floor(Math.random() * PRELOADED_STICKER_IMAGES.length),
        delay: Math.random() * 85,
      });
    }

    let active = true;
    let lastTime = performance.now();

    const update = (time: number) => {
      if (!active || !canvas || !ctx) return;
      const dt = (time - lastTime) / 16.666;
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDead = true;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.delay > 0) {
          p.delay -= dt;
          allDead = false;
          continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.022 * dt;

        if (p.vy > 0) {
          p.opacity = Math.max(0, p.opacity - 0.007 * dt);
        }
        if (p.opacity > 0) {
          allDead = false;
        }

        p.rotation += p.rotationSpeed * dt;

        const xPx = (p.x / 100) * canvas.width;
        const yPx = (p.y / 100) * canvas.height;
        const size = 90 * p.scale;

        ctx.save();
        ctx.translate(xPx, yPx);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        const img = PRELOADED_STICKER_IMAGES[p.imgIdx];
        if (img && img.complete) {
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
        }
        ctx.restore();
      }

      if (allDead) {
        active = false;
      } else {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  };

  // Fire poppers on initial mount and on slide 0 & 5
  useEffect(() => {
    if (!isMonthsaryOpen) return;
    if (currentSlide === 0 || currentSlide === 5) {
      fireLilyPoppers();
    }
  }, [isMonthsaryOpen, currentSlide]);

  // Story progress timer
  useEffect(() => {
    if (!isMonthsaryOpen || isPaused) return;

    const interval = 50;
    const step = (interval / SLIDE_DURATION_MS) * 100;

    timerRef.current = window.setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide((s) => s + 1);
            return 0;
          } else {
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMonthsaryOpen, isPaused, currentSlide]);

  useEffect(() => {
    setSlideProgress(0);
  }, [currentSlide]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((c) => c + 1);
    } else {
      closeMonthsary();
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentSlide > 0) {
      setCurrentSlide((c) => c - 1);
    }
  };

  const handleContainerTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // Left 30% goes back, right 70% goes forward
    if (x < width * 0.3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlide(0);
    setSlideProgress(0);
    fireLilyPoppers();
  };

  if (!isMonthsaryOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none"
        style={{ background: "var(--gradient-sky)" }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onClick={handleContainerTap}
      >
        {/* Confetti canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-30"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Ambient atmospheric blobs & sparkles */}
        <AmbientBlobs />
        <BackgroundSparkles />

        {/* Top Story Header: Progress Bars & Close Button (No volume) */}
        <div className="relative z-40 px-5 pt-4 pb-2 flex flex-col gap-2.5">
          {/* Progress bar segments */}
          <div className="flex items-center gap-1.5 w-full">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => {
              let fillPercent = 0;
              if (idx < currentSlide) fillPercent = 100;
              else if (idx === currentSlide) fillPercent = slideProgress;

              return (
                <div
                  key={idx}
                  className="h-1 flex-1 bg-foreground/15 rounded-full overflow-hidden backdrop-blur-sm"
                >
                  <div
                    className="h-full bg-primary transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Simple header */}
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs font-bold text-foreground/80 tracking-wide">
              3rd Monthsary
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMonthsary();
              }}
              className="p-1.5 rounded-full bg-white/60 hover:bg-white/80 active:scale-95 transition border border-white/60 text-foreground shadow-2xs"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Slide Content */}
        <div className="relative z-20 flex-1 flex flex-col justify-center items-center px-6 max-w-md mx-auto w-full text-center min-h-0">
          <AnimatePresence mode="wait">
            {/* SLIDE 0: 1st Monthsary Tribute Greeting */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto"
              >
                {/* Letter by letter animated title in text-foreground */}
                <motion.h1
                  variants={sentenceVariants}
                  initial="hidden"
                  animate="visible"
                  className="display text-4xl sm:text-5xl font-extrabold leading-tight text-foreground flex flex-wrap justify-center"
                >
                  {"Happy 3rd Monthsary, Aya!".split(" ").map((word, wordIdx) => (
                    <span key={wordIdx} className="inline-block whitespace-nowrap mr-2.5">
                      {Array.from(word).map((char, charIdx) => (
                        <motion.span
                          key={charIdx}
                          variants={letterVariants}
                          className="inline-block"
                        >
                          {char}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  className="mt-2 text-xs sm:text-sm text-muted-foreground font-medium"
                >
                  three months of us
                </motion.p>

                {/* Floating Lily Bouquet with glowing backdrop and 8 twinkling stars */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 95 }}
                  className="my-8 relative flex justify-center items-center"
                >
                  {/* Pulsing glow */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute w-56 h-56 bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(14,165,233,0.3)_60%,transparent_100%)] blur-lg rounded-full"
                  />

                  {/* Couple Sticker Image */}
                  <motion.img
                    animate={{ y: [0, -9, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    src="/couple-sticker.png"
                    alt="Sean & Aya Sticker"
                    className="relative w-64 h-64 sm:w-72 sm:h-72 object-contain drop-shadow-[0_12px_28px_rgba(14,165,233,0.22)]"
                  />

                  {/* 8 Twinkling Stars */}
                  <TwinklingStar top="12%" left="18%" delay={0} duration={2.0} rotate={90} />
                  <TwinklingStar top="16%" right="20%" delay={0.6} duration={1.8} rotate={-90} />
                  <TwinklingStar top="34%" right="14%" delay={1.2} duration={2.2} rotate={90} />
                  <TwinklingStar bottom="20%" left="22%" delay={0.4} duration={2.1} rotate={-90} />
                  <TwinklingStar bottom="14%" right="24%" delay={0.9} duration={1.9} rotate={90} />
                  <TwinklingStar top="48%" left="12%" delay={1.4} duration={2.3} rotate={-90} />
                  <TwinklingStar bottom="8%" left="46%" delay={0.7} duration={1.7} rotate={90} />
                  <TwinklingStar top="8%" left="48%" delay={1.1} duration={2.0} rotate={-90} />
                </motion.div>

                {/* Bottom Call to Action */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-xs font-medium text-muted-foreground/80 tracking-wide"
                >
                  tap anywhere to see our story
                </motion.div>
              </motion.div>
            )}

            {/* SLIDE 1: Our Timeline & Activity */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto space-y-4"
              >
                <div className="space-y-1 text-center">
                  <h2 className="display text-3xl sm:text-4xl font-extrabold text-foreground">
                    3 months together
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    since June 19, 2026
                  </p>
                </div>

                {/* Days Counter Card */}
                <div className="w-full rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl p-5 shadow-soft text-center space-y-4">
                  <div>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="display text-5xl sm:text-6xl font-black text-primary">
                        {daysTogether}
                      </span>
                      <span className="text-base font-bold text-foreground/70">days</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      of loving each other through everything
                    </p>
                  </div>

                  {/* Activity Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/50">
                    <div className="rounded-2xl bg-white/60 p-3.5 flex flex-col items-center border border-white/40">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      >
                        <Heart size={20} className="text-primary fill-primary" />
                      </motion.div>
                      <div className="display text-2xl font-black text-foreground mt-1.5">
                        {stats?.hugsCount ?? 35}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">
                        hugs sent
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/60 p-3.5 flex flex-col items-center border border-white/40">
                      <Layers size={20} className="text-primary" />
                      <div className="display text-2xl font-black text-foreground mt-1.5">
                        {stats?.notes.length ?? 5}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-bold mt-0.5 uppercase tracking-wider">
                        notes on wall
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground italic pt-1">
                    "Every little note and hug here reminds me of how lucky I am to have you."
                  </p>
                </div>
              </motion.div>
            )}

            {/* SLIDE 2: Added Pictures & Milestones */}
            {currentSlide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto space-y-3.5"
              >
                <div className="space-y-1 text-center">
                  <h2 className="display text-3xl sm:text-4xl font-extrabold text-foreground">
                    Memories we've saved
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    A few snapshots of us along the way
                  </p>
                </div>

                {/* Polaroid Showcase */}
                <div className="w-full flex items-center justify-center gap-3 py-1 overflow-hidden">
                  {(stats?.memories.slice(0, 3) || []).map((m, idx) => {
                    const rotations = [-3, 3, -1];
                    const rot = rotations[idx % rotations.length];
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 15, rotate: 0 }}
                        animate={{ opacity: 1, y: 0, rotate: rot }}
                        transition={{ delay: 0.12 * idx, duration: 0.35 }}
                        className="w-28 sm:w-32 rounded-xl bg-white p-2 shadow-md border border-white/60"
                      >
                        {/* Washi tape header */}
                        <div className="w-10 h-2.5 bg-sky-100/90 -mt-3 mx-auto rounded-xs rotate-[-2deg] border border-sky-200/40" />
                        <div className="aspect-square w-full rounded-lg overflow-hidden bg-sky-50 mt-1">
                          {m.cover_url ? (
                            <img
                              src={m.cover_url}
                              alt={m.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-sky-50">
                              <Camera size={18} className="text-primary/60" />
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 text-left">
                          <div className="text-[10px] font-bold text-foreground truncate">
                            {m.title}
                          </div>
                          <div className="text-[8px] text-muted-foreground">
                            {m.memory_date || "Cherished"}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Subtitle card */}
                <div className="w-full rounded-2xl border border-white/60 bg-white/55 backdrop-blur-xl p-3.5 text-center text-xs text-foreground/80 leading-relaxed shadow-2xs">
                  From our 1st & 2nd monthsary to my 22nd birthday with your sweet donut cake effort, thank you for always making me smile.
                </div>
              </motion.div>
            )}

            {/* SLIDE 3: Added Stickers */}
            {currentSlide === 3 && (
              <motion.div
                key="slide-3"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto space-y-4"
              >
                <div className="space-y-1 text-center">
                  <h2 className="display text-3xl sm:text-4xl font-extrabold text-foreground">
                    Our sticker collection
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {stats?.stickers.length ?? 9} stickers placed on our board
                  </p>
                </div>

                {/* Floating stickers board with all 9 stickers */}
                <div className="relative w-full h-56 sm:h-64 rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl p-3 overflow-hidden flex items-center justify-center shadow-soft">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {displayStickers.map((s, idx) => {
                      const positions = [
                        { top: "6%", left: "6%", rotate: -10, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { top: "5%", left: "40%", rotate: 8, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { top: "7%", right: "6%", rotate: -12, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { top: "37%", left: "6%", rotate: 10, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { top: "33%", left: "37%", rotate: -4, size: "w-16 h-16 sm:w-20 sm:h-20", scale: 1.15 },
                        { top: "36%", right: "6%", rotate: -8, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { bottom: "7%", left: "8%", rotate: -7, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { bottom: "5%", left: "40%", rotate: 6, size: "w-14 h-14 sm:w-16 sm:h-16" },
                        { bottom: "7%", right: "8%", rotate: 11, size: "w-14 h-14 sm:w-16 sm:h-16" },
                      ];
                      const pos = positions[idx % positions.length];
                      return (
                        <motion.img
                          key={s.id}
                          src={s.image_url}
                          alt="Sticker"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{
                            scale: pos.scale || 1,
                            opacity: 1,
                            rotate: [pos.rotate - 2, pos.rotate + 2, pos.rotate - 2],
                          }}
                          transition={{
                            delay: 0.05 * idx,
                            opacity: { duration: 0.25 },
                            rotate: { duration: 3 + (idx % 3) * 0.4, repeat: Infinity, ease: "easeInOut" },
                          }}
                          style={{
                            position: "absolute",
                            top: pos.top,
                            left: pos.left,
                            right: pos.right,
                            bottom: pos.bottom,
                          }}
                          className={`${pos.size} object-contain drop-shadow-[0_4px_10px_rgba(14,165,233,0.2)]`}
                        />
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  "Every sticker we place makes this little corner feel more like home."
                </p>
              </motion.div>
            )}

            {/* SLIDE 4: Added Cats */}
            {currentSlide === 4 && (
              <motion.div
                key="slide-4"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto space-y-3.5"
              >
                <div className="space-y-1 text-center">
                  <h2 className="display text-3xl sm:text-4xl font-extrabold text-foreground">
                    Our 3 cats
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Mallows, Daichi, and Mingg
                  </p>
                </div>

                {/* Cats Cards */}
                <div className="grid grid-cols-3 gap-2.5 w-full py-1">
                  {(stats?.pets.length ? stats.pets : [
                    { id: "1", name: "Mallows", photos: [], species: "cat", created_at: "" },
                    { id: "2", name: "Daichi", photos: [], species: "cat", created_at: "" },
                    { id: "3", name: "Mingg", photos: [], species: "cat", created_at: "" },
                  ]).map((pet, idx) => (
                    <motion.div
                      key={pet.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 * idx }}
                      className="rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl p-2.5 flex flex-col items-center shadow-xs"
                    >
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/80 shadow-xs bg-sky-50">
                        {pet.photos?.[0] ? (
                          <img
                            src={pet.photos[0]}
                            alt={pet.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-sky-100/60">
                            <Heart size={20} className="text-primary/60 fill-primary/20" />
                          </div>
                        )}
                      </div>
                      <span className="display text-sm font-bold text-foreground mt-1.5 truncate max-w-full">
                        {pet.name}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <div className="w-full rounded-2xl border border-white/60 bg-white/55 backdrop-blur-xl p-3 text-center text-xs text-foreground/80 shadow-2xs">
                  Our three little companions keeping our room warm and full of life.
                </div>
              </motion.div>
            )}

            {/* SLIDE 5: Summary Card & Letter */}
            {currentSlide === 5 && (
              <motion.div
                key="slide-5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center w-full my-auto space-y-3.5"
              >
                {/* Main Card in Blue & White frosted glass */}
                <div className="w-full rounded-3xl border border-white/70 bg-white/75 backdrop-blur-2xl p-5 shadow-soft text-left space-y-3.5">
                  {/* Header without Spotify Wrapped */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="display text-xl sm:text-2xl font-black text-foreground leading-tight">
                        Sean & Aya's 3rd Monthsary
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground bg-white/80 border border-white/60 px-2.5 py-1 rounded-full shadow-2xs shrink-0">
                      Sep 19, 2026
                    </div>
                  </div>

                  {/* 4 Metric Pills Grid */}
                  <div className="grid grid-cols-2 gap-2 text-foreground">
                    <div className="rounded-2xl bg-white/85 p-3 border border-white/60 shadow-2xs">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                        Together
                      </div>
                      <div className="text-base font-black text-primary mt-0.5">
                        {daysTogether} Days
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/85 p-3 border border-white/60 shadow-2xs">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                        Milestones
                      </div>
                      <div className="text-base font-black text-primary mt-0.5">
                        {stats?.memories.length ?? 4} Photos
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/85 p-3 border border-white/60 shadow-2xs">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                        Stickers
                      </div>
                      <div className="text-base font-black text-primary mt-0.5">
                        {stats?.stickers.length ?? 9} Placed
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/85 p-3 border border-white/60 shadow-2xs">
                      <div className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                        Cats
                      </div>
                      <div className="text-base font-black text-primary mt-0.5">
                        3
                      </div>
                    </div>
                  </div>

                  {/* Letter from Sj */}
                  <div className="rounded-2xl bg-white/60 border border-white/50 p-4 text-foreground/90 text-xs leading-relaxed space-y-2 shadow-2xs">
                    <p className="font-bold text-foreground">Dearest Aya,</p>
                    <p className="text-foreground/80">
                      Happy 3rd Monthsary! Thank you for 3 wonderful months of joy, sweetness, and comfort. Even through any distance, you always make me feel like the happiest boy. Here's to endless more months, more memories, more stickers, and a lifetime together. I love you so much!
                    </p>
                    <p className="text-right font-bold text-primary pt-0.5">
                      — Forever yours, Sj
                    </p>
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div
                  className="flex items-center gap-2.5 w-full pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={handleRestart}
                    className="flex-1 rounded-full border border-white/70 bg-white/60 backdrop-blur-xl py-2.5 px-4 text-xs font-bold text-foreground hover:bg-white/80 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    Replay
                  </button>

                  <button
                    onClick={closeMonthsary}
                    className="flex-[2] rounded-full bg-primary text-primary-foreground py-2.5 px-4 text-xs font-bold hover:opacity-95 active:scale-95 transition flex items-center justify-center shadow-soft"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom footer */}
        <div className="relative z-30 pb-4 px-6 text-center text-muted-foreground/70 text-[10px]">
          {currentSlide < TOTAL_SLIDES - 1 ? (
            <div className="flex items-center justify-center gap-1.5">
              <span>Tap left or right to browse</span>
              <span>·</span>
              <span>Hold to pause</span>
            </div>
          ) : (
            <span>Sean & Aya · September 19, 2026</span>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
}

function TwinklingStar({
  top,
  left,
  right,
  bottom,
  delay,
  duration,
  rotate,
}: {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  delay: number;
  duration: number;
  rotate: number;
}) {
  return (
    <motion.svg
      animate={{
        scale: [0, 1.2, 0],
        opacity: [0, 1, 0],
        rotate: [0, rotate],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatDelay: 0.5,
        delay,
      }}
      style={{ top, left, right, bottom }}
      className="absolute w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
    </motion.svg>
  );
}
