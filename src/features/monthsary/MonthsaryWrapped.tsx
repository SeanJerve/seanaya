import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/features/app/store";
import { useCoupleNames } from "@/hooks/useCouple";
import { useRelationship } from "@/hooks/useRelationship";
import { X, Heart, RotateCcw, ChevronRight, Camera, Layers } from "lucide-react";

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
  "/couple-sticker.webp",
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
  coupleImg.src = "/couple-sticker.webp";
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
        className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#c9d6fb]/60 blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.06, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-[#e4eafc]/50 blur-2xl"
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
  const couple = useCoupleNames();
  const nameA = couple.slot === "a" ? couple.me : couple.partner;
  const nameB = couple.slot === "a" ? couple.partner : couple.me;
  const { data: rel } = useRelationship();
  const startISO = rel?.anniversary || "2026-06-19";
  const startLabel = new Date(startISO + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
        hugsCount: hugsRes.count ?? 0,
      };
    },
  });

  // Calculate days together since June 19, 2026
  const daysTogether = useMemo(() => {
    const start = new Date(startISO + "T00:00:00");
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [startISO]);

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

  const pets = stats?.pets ?? [];
  const petNames =
    pets.length === 0
      ? ""
      : pets.length === 1
        ? pets[0].name
        : `${pets.slice(0, -1).map((p) => p.name).join(", ")} and ${pets[pets.length - 1].name}`;
  const slideMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.38, ease: [0.2, 0, 0, 1] as const },
  };
  const title = "font-serif text-[34px] font-semibold leading-[1.1] text-sn-navy sm:text-[44px]";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex select-none flex-col justify-between overflow-hidden"
        style={{ background: "var(--gradient-sky)" }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onClick={handleContainerTap}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-30" style={{ width: "100%", height: "100%" }} />
        <AmbientBlobs />
        <BackgroundSparkles />

        {/* Progress + close */}
        <div className="relative z-40 mx-auto flex w-full max-w-[720px] flex-col gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex w-full items-center gap-1.5">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => {
              const fill = idx < currentSlide ? 100 : idx === currentSlide ? slideProgress : 0;
              return (
                <div key={idx} className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/55">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#a9c0f6,#7f9fe9)] transition-[width] duration-75 ease-linear"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="sn-label">3rd monthsary</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMonthsary();
              }}
              aria-label="Close"
              className="sn-pill sn-icon-btn h-10 w-10"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Slides */}
        <div className="relative z-20 mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col items-center justify-center px-6 text-center">
          <AnimatePresence mode="wait">
            {currentSlide === 0 && (
              <motion.div key="s0" {...slideMotion} className="flex w-full flex-col items-center">
                <motion.h1
                  variants={sentenceVariants}
                  initial="hidden"
                  animate="visible"
                  className={`${title} flex flex-wrap justify-center`}
                >
                  {`Happy 3rd monthsary, ${nameB}`.split(" ").map((word, wi) => (
                    <span key={wi} className="mr-2.5 inline-block whitespace-nowrap">
                      {Array.from(word).map((ch, ci) => (
                        <motion.span key={ci} variants={letterVariants} className="inline-block">
                          {ch}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="sn-hand mt-2 text-[22px] text-sn-ink"
                >
                  three months of us
                </motion.p>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 95 }}
                  className="relative my-8 flex items-center justify-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.7, 0.45] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(201,214,251,0.5)_60%,transparent_100%)] blur-lg"
                  />
                  <motion.img
                    animate={{ y: [0, -9, 0] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                    src="/couple-sticker.webp"
                    alt={`${nameA} and ${nameB}`}
                    className="relative h-60 w-60 object-contain drop-shadow-[0_14px_28px_rgba(50,70,150,0.25)] sm:h-72 sm:w-72"
                  />
                  <TwinklingStar top="12%" left="18%" delay={0} duration={2.0} rotate={90} />
                  <TwinklingStar top="16%" right="20%" delay={0.6} duration={1.8} rotate={-90} />
                  <TwinklingStar bottom="18%" left="20%" delay={0.4} duration={2.1} rotate={-90} />
                  <TwinklingStar bottom="12%" right="22%" delay={0.9} duration={1.9} rotate={90} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-[14px] text-sn-muted"
                >
                  Tap to begin
                </motion.div>
              </motion.div>
            )}

            {currentSlide === 1 && (
              <motion.div key="s1" {...slideMotion} className="flex w-full flex-col items-center">
                <h2 className={title}>Three months together</h2>
                <div className="mt-8 flex items-baseline gap-3">
                  <span className="font-serif text-[96px] font-bold leading-none tracking-[-0.02em] text-sn-navy tabular-nums sm:text-[120px]">
                    {daysTogether}
                  </span>
                  <span className="font-serif text-[28px] text-sn-ink">days</span>
                </div>
                <div className="mt-1 text-[15px] text-sn-muted">since {startLabel}</div>
                <div className="mt-10 flex items-start justify-center gap-14">
                  <div>
                    <div className="font-serif text-[40px] font-semibold leading-none text-sn-navy tabular-nums">
                      {stats?.hugsCount ?? 0}
                    </div>
                    <div className="mt-2 text-[14px] text-sn-ink">hugs sent</div>
                  </div>
                  <div>
                    <div className="font-serif text-[40px] font-semibold leading-none text-sn-navy tabular-nums">
                      {stats?.notes.length ?? 0}
                    </div>
                    <div className="mt-2 text-[14px] text-sn-ink">notes on the wall</div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentSlide === 2 && (
              <motion.div key="s2" {...slideMotion} className="flex w-full flex-col items-center">
                <h2 className={title}>Memories we kept</h2>
                <div className="mt-8 flex w-full items-start justify-center gap-3 sm:gap-5">
                  {(stats?.memories.slice(0, 3) || []).map((m, idx) => {
                    const rot = [-4, 3, -2][idx % 3];
                    return (
                      <motion.figure
                        key={m.id}
                        initial={{ opacity: 0, y: 16, rotate: 0 }}
                        animate={{ opacity: 1, y: 0, rotate: rot }}
                        transition={{ delay: 0.12 * idx, duration: 0.4 }}
                        className="w-[30%] max-w-[150px] rounded-[3px] bg-white p-2 pb-3 shadow-[0_16px_30px_-16px_rgba(50,70,150,0.6)]"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-[#e6ecfc]">
                          {m.cover_url ? (
                            <img src={m.cover_url} alt={m.title} className="h-full w-full object-cover" />
                          ) : (
                            <img src="/lily2.webp" alt="" className="h-full w-full object-contain p-3" />
                          )}
                        </div>
                        <figcaption className="mt-2 truncate text-left font-serif text-[14px] font-semibold text-sn-navy">
                          {m.title}
                        </figcaption>
                      </motion.figure>
                    );
                  })}
                </div>
                <p className="sn-hand mt-8 max-w-[440px] text-[20px] leading-snug text-sn-ink">
                  From our 1st and 2nd monthsary to my 22nd birthday with your sweet donut cake,
                  thank you for always making me smile.
                </p>
              </motion.div>
            )}

            {currentSlide === 3 && (
              <motion.div key="s3" {...slideMotion} className="flex w-full flex-col items-center">
                <h2 className={title}>Our stickers</h2>
                <div className="mt-1 text-[15px] text-sn-muted">
                  {stats?.stickers.length ?? 0} made together
                </div>
                <div className="relative mt-6 h-64 w-full sm:h-72">
                  {displayStickers.map((s, idx) => {
                    const positions = [
                      { top: "4%", left: "4%", rotate: -10 },
                      { top: "2%", left: "39%", rotate: 8 },
                      { top: "5%", right: "4%", rotate: -12 },
                      { top: "36%", left: "2%", rotate: 10 },
                      { top: "32%", left: "36%", rotate: -4, big: true },
                      { top: "35%", right: "2%", rotate: -8 },
                      { bottom: "4%", left: "6%", rotate: -7 },
                      { bottom: "2%", left: "40%", rotate: 6 },
                      { bottom: "4%", right: "6%", rotate: 11 },
                    ];
                    const pos = positions[idx % positions.length];
                    return (
                      <motion.img
                        key={s.id}
                        src={s.image_url}
                        alt=""
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: pos.big ? 1.15 : 1,
                          opacity: 1,
                          rotate: [pos.rotate - 2, pos.rotate + 2, pos.rotate - 2],
                        }}
                        transition={{
                          delay: 0.05 * idx,
                          opacity: { duration: 0.25 },
                          rotate: { duration: 3 + (idx % 3) * 0.4, repeat: Infinity, ease: "easeInOut" },
                        }}
                        style={{ position: "absolute", top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom }}
                        className={`${pos.big ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20"} object-contain drop-shadow-[0_6px_12px_rgba(50,70,150,0.25)]`}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}

            {currentSlide === 4 && (
              <motion.div key="s4" {...slideMotion} className="flex w-full flex-col items-center">
                <h2 className={title}>{pets.length ? `Our ${pets.length} cats` : "Our cats"}</h2>
                {petNames && <div className="mt-1 text-[15px] text-sn-muted">{petNames}</div>}
                {pets.length > 0 ? (
                  <div className="mt-10 flex flex-wrap items-start justify-center gap-8">
                    {pets.map((pet, idx) => (
                      <motion.div
                        key={pet.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 * idx }}
                        className="flex flex-col items-center"
                      >
                        <div className="h-24 w-24 overflow-hidden rounded-full border-[3px] border-white bg-[#e6ecfc] shadow-[0_12px_24px_-12px_rgba(50,70,150,0.55)]">
                          {pet.photos?.[0] ? (
                            <img src={pet.photos[0]} alt={pet.name} className="h-full w-full object-cover" />
                          ) : (
                            <img src="/art/cat-peek.webp" alt="" className="h-full w-full scale-150 object-contain pt-4" />
                          )}
                        </div>
                        <span className="mt-2.5 font-serif text-[18px] font-semibold text-sn-navy">{pet.name}</span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <img src="/art/cats-cloud.webp" alt="" className="mt-8 w-[220px]" />
                )}
              </motion.div>
            )}

            {currentSlide === 5 && (
              <motion.div key="s5" {...slideMotion} className="flex w-full flex-col items-center">
                <h2 className={title}>
                  {nameA} &amp; {nameB}
                </h2>
                <div className="mt-1 text-[15px] text-sn-muted">3rd monthsary · September 19, 2026</div>
                <div className="mt-7 grid w-full grid-cols-4 gap-2">
                  {[
                    [daysTogether, "days"],
                    [stats?.memories.length ?? 0, "memories"],
                    [stats?.stickers.length ?? 0, "stickers"],
                    [pets.length, "cats"],
                  ].map(([n, label]) => (
                    <div key={label as string}>
                      <div className="font-serif text-[30px] font-semibold leading-none text-sn-navy tabular-nums">{n}</div>
                      <div className="mt-1.5 text-[13px] text-sn-ink">{label}</div>
                    </div>
                  ))}
                </div>
                {/* The letter: the one thing on paper */}
                <div className="sn-card mt-7 w-full rotate-[-0.6deg] p-6 text-left">
                  <p className="font-serif text-[20px] font-semibold text-sn-navy">Dearest {nameB},</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-sn-ink">
                    Happy 3rd monthsary! Thank you for three wonderful months of joy, sweetness and
                    comfort. Even through the distance, you always make me feel like the happiest boy.
                    Here's to endless more months, more memories, more stickers, and a lifetime
                    together. I love you so much!
                  </p>
                  <p className="sn-hand mt-3 text-right text-[22px] text-sn-navy">Forever yours, {nameA}</p>
                </div>
                <div className="mt-6 flex w-full gap-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={handleRestart} className="sn-pill h-12 flex-1 text-[15px]">
                    <RotateCcw size={16} strokeWidth={1.9} />
                    Replay
                  </button>
                  <button onClick={closeMonthsary} className="sn-pill h-12 flex-[2] text-[15px]">
                    Continue
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative z-30 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[13px] text-sn-muted">
          {currentSlide < TOTAL_SLIDES - 1 ? "Tap left or right to browse · hold to pause" : `${nameA} & ${nameB}`}
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
