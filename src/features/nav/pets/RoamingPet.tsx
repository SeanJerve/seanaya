import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { TabKey } from "@/features/app/store";

/**
 * Chibi cats that wander along the floating dock.
 * States: walk, run (zoomies), sit (tail wag), sleep (curled, breathing), play (hop).
 * When two cats meet they stop, face each other, a heart pops, and sometimes one chases the other.
 */

type Mode = "walk" | "run" | "sit" | "sleep" | "play";

const LINES: Record<string, string[]> = {
  home: ["Send a hug today?", "I like sitting here with you.", "You two are so sweet."],
  calendar: ["So many days together.", "Look at all these moments.", "Mark a date for us?"],
  memories: ["Let's flip the album!", "That page is my favourite.", "More photos, please."],
  wall: ["Leave a little note?", "Polaroids make me purr.", "I read every note."],
  stickers: ["These stickers are cute.", "Make a new one?", "{name} likes the outlines."],
  pet: ["This is my room.", "Room for one more cat?", "Pet me, please."],
  photobooth: ["Say cheese!", "Smile for the strip.", "Four frames, go!"],
};
const MEOWS = ["Meow!", "Purrr…", "Prrrt?", "Mrow!", "Hi hi!"];
const GREETS = ["Hi {other}!", "Boop!", "Wanna race?", "There you are!", "Sniff sniff…"];

/** Coat palettes: [coat, shade, stripe/patch, belly] */
const COATS: Record<string, [string, string, string, string]> = {
  orange: ["#f8cf9a", "#e7a868", "#e9a15f", "#fff3e4"],
  white: ["#fbf8f4", "#e3dde4", "#c9c2cc", "#ffffff"],
  black: ["#5a5466", "#433d4e", "#2f2a39", "#7b7488"],
  grey: ["#c9c6d6", "#a7a3b8", "#8f8aa3", "#ece9f3"],
  calico: ["#fbf6ef", "#e3dad6", "#f0a96a", "#ffffff"],
};

const parseVariant = (v: string | null) => {
  const [faceMode = "cartoon", patternMode = "color", patternColor = "orange"] = (v ?? "").split(":");
  return { faceMode, patternMode, patternColor };
};

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const isMoving = (m: Mode) => m === "walk" || m === "run";
/** % of dock width per second (was 0.2 / 0.62 per 50ms tick) */
const WALK_SPEED = 4;
const RUN_SPEED = 12.4;

type Align = "left" | "right" | "center";
const alignFor = (x: number): Align => (x < 16 ? "left" : x > 84 ? "right" : "center");

// One cat talks at a time
let lastBubbleAt = 0;
const canSpeak = (gap = 2600) => Date.now() - lastBubbleAt > gap;

export function RoamingPet({
  pet,
  otherPets,
  index,
  tab,
  petPositionsRef,
}: {
  pet: { id: string; name: string; photos?: string[] | null; variant?: string | null };
  otherPets: { id: string; name: string }[];
  index: number;
  tab: TabKey;
  petPositionsRef: MutableRefObject<Record<string, number>>;
}) {
  const prefersReduced = useReducedMotion();
  const still = prefersReduced ?? reduceMotion();
  const [dir, setDirState] = useState<1 | -1>(index % 2 ? -1 : 1);
  const [mode, setModeState] = useState<Mode>(still ? "sit" : "walk");
  const [bubble, setBubble] = useState<string | null>(null);
  const [heart, setHeart] = useState(false);
  const [asleepLocked, setAsleepLocked] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);

  // Horizontal position (% of the dock width) lives in a ref and is written straight to the DOM
  // as a transform, so walking never re-renders React or triggers layout.
  const rootRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(14 + index * 26);
  const dockWidth = useRef(0);
  const [align, setAlign] = useState<Align>(() => alignFor(xRef.current));
  const alignRef = useRef(align);

  const st = useRef({ dir, mode, until: Date.now() + 5000, meetCooldown: 0 });
  const pressAt = useRef(0);
  const holdTimer = useRef<number | null>(null);
  const setDir = (d: 1 | -1) => {
    st.current.dir = d;
    setDirState(d);
  };
  const setMode = (m: Mode) => {
    st.current.mode = m;
    setModeState(m);
  };

  const applyX = (nx: number) => {
    xRef.current = nx;
    petPositionsRef.current[pet.id] = nx;
    const el = rootRef.current;
    if (el) el.style.transform = `translate3d(${(nx / 100) * dockWidth.current}px,0,0)`;
    const a = alignFor(nx);
    if (a !== alignRef.current) {
      alignRef.current = a;
      setAlign(a);
    }
  };

  // Every timeout is tracked so it can be cleared on unmount
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  };

  const say = (text: string, ms = 3000, force = false) => {
    if (!force && !canSpeak()) return;
    lastBubbleAt = Date.now();
    setBubble(text.replace("{name}", pet.name || "I"));
    later(() => setBubble((b) => (b === text.replace("{name}", pet.name || "I") ? null : b)), ms);
  };

  // Measure the dock so % positions map to px; publish our position for the other cats
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      dockWidth.current = parent.clientWidth;
      applyX(xRef.current);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(parent);
    return () => {
      ro?.disconnect();
      delete petPositionsRef.current[pet.id];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.id]);

  // Pause when the tab is hidden
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Reduced motion: stay put (sit/sleep only)
  useEffect(() => {
    if (still && st.current.mode !== "sit" && st.current.mode !== "sleep") setMode("sit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  // Clear everything on unmount
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach((id) => window.clearTimeout(id));
      set.clear();
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    };
  }, []);

  // A line when the page changes (first cat speaks)
  useEffect(() => {
    if (asleepLocked || index !== 0) return;
    const lines = LINES[tab] ?? MEOWS;
    const t = window.setTimeout(() => say(lines[Math.floor(Math.random() * lines.length)], 3400), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Behaviour loop: a rAF loop while walking/running, a single timeout while resting.
  // Restarts whenever the mode changes; nothing runs while hidden, held asleep, or with reduced motion.
  useEffect(() => {
    if (still || hidden || asleepLocked) return;
    const s = st.current;
    let raf = 0;
    let timer = 0;
    let last = 0;

    // Pick the next thing to do
    const decide = (now: number) => {
      if (now <= s.until) return;
      const r = Math.random();
      const next: Mode = r < 0.5 ? "walk" : r < 0.62 ? "run" : r < 0.88 ? "sit" : "sleep";
      setMode(next);
      s.until = now + (next === "sleep" ? 9000 : next === "run" ? 2200 : 4000 + Math.random() * 4000);
      if (next === "walk" && Math.random() < 0.3) setDir(s.dir === 1 ? -1 : 1);
    };

    // Meet another cat
    const meet = (now: number) => {
      const x = xRef.current;
      for (const o of otherPets) {
        if (o.id === pet.id) continue;
        const ox = petPositionsRef.current[o.id];
        if (ox === undefined || Math.abs(ox - x) > 7) continue;
        s.meetCooldown = now + 16000;
        setDir(ox > x ? 1 : -1);
        setMode("sit");
        s.until = now + 2200;
        const leader = pet.id < o.id;
        if (leader) {
          setHeart(true);
          later(() => setHeart(false), 1400);
          say(GREETS[Math.floor(Math.random() * GREETS.length)].replace("{other}", o.name || "you"), 2200, true);
        }
        // Zoomies (both cats agree via the same time bucket): the leader dashes away, the other chases.
        if (Math.floor(now / 4000) % 2 === 0) {
          const runDir: 1 | -1 = leader ? (x >= ox ? 1 : -1) : ox >= x ? 1 : -1;
          later(
            () => {
              setDir(runDir);
              setMode("run");
              st.current.until = Date.now() + 2600;
            },
            leader ? 1500 : 1900,
          );
        }
        return true;
      }
      return false;
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(t - last, 100) : 0; // ms, capped so a stalled frame doesn't teleport
      last = t;
      const now = Date.now();
      if (!isMoving(s.mode)) return; // mode just changed; the effect restarts with the idle driver
      if (now > s.meetCooldown && meet(now)) return;
      decide(now);

      // Move: same speeds as before (0.2% / 0.62% per 50ms), now frame-rate independent
      const speed = s.mode === "run" ? RUN_SPEED : s.mode === "walk" ? WALK_SPEED : 0;
      if (speed) {
        let nx = xRef.current + s.dir * speed * (dt / 1000);
        if (nx > 88) {
          nx = 88;
          if (s.dir !== -1) setDir(-1);
        } else if (nx < 6) {
          nx = 6;
          if (s.dir !== 1) setDir(1);
        }
        applyX(nx);
      }
    };

    const idle = () => {
      const wait = s.until - Date.now();
      if (wait <= 0) decide(Date.now());
      // If decide() switched to a moving mode the effect restarts; otherwise wait for the next deadline.
      if (!isMoving(s.mode)) timer = window.setTimeout(idle, Math.max(16, s.until - Date.now() + 1));
    };

    if (isMoving(mode)) raf = requestAnimationFrame(frame);
    else idle();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hidden, asleepLocked, otherPets, pet.id, still]);

  // Tap = play, hold = sleep, tap while asleep = wake
  const onDown = () => {
    pressAt.current = Date.now();
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setAsleepLocked(true);
      setMode("sleep");
      say("Good night…", 1800, true);
    }, 750);
  };
  const onUp = () => {
    if (holdTimer.current === null) return;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (asleepLocked) {
      setAsleepLocked(false);
      setMode(still ? "sit" : "play");
      st.current.until = Date.now() + 900;
      say("Good morning!", 1800, true);
      return;
    }
    if (!still) setMode("play");
    st.current.until = Date.now() + 900;
    say(MEOWS[Math.floor(Math.random() * MEOWS.length)], 2200, true);
  };

  const v = parseVariant(pet.variant ?? null);
  const face = v.faceMode === "photo" && pet.photos?.[0] ? pet.photos[0] : null;
  const coatPhoto = v.patternMode === "photo" && pet.photos?.[1] ? pet.photos[1] : null;
  const sampled = usePhotoCoat(coatPhoto ?? face);
  const coat = sampled ?? COATS[v.patternColor] ?? COATS.orange;

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute bottom-full z-40 mb-[-6px] h-[48px] w-[64px] -translate-x-1/2 cursor-pointer touch-none select-none"
      style={{ left: 0, willChange: "transform" }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={() => {
        if (holdTimer.current) window.clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }}
      role="img"
      aria-label={pet.name}
    >
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className={`pointer-events-none absolute bottom-full mb-2.5 w-max max-w-[156px] rounded-[16px] border border-white/90 bg-white/85 px-3 py-1.5 text-center text-[13px] font-semibold leading-snug text-sn-navy shadow-[0_8px_20px_-10px_rgba(60,80,160,0.55)] backdrop-blur-md ${
              align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
            }`}
          >
            {bubble}
            <span
              className={`absolute top-full h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-white/85 ${
                align === "left" ? "left-5" : align === "right" ? "right-5" : "left-1/2 -translate-x-1/2"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {heart && (
          <motion.img
            src="/art/clay-heart.png"
            alt=""
            initial={{ opacity: 0, y: 4, scale: 0.4 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2"
          />
        )}
      </AnimatePresence>

      {mode === "sleep" && (
        <span className="sn-zzz pointer-events-none absolute -top-2 right-1 font-serif text-[13px] font-semibold italic text-[#6f7fbd]">
          z
        </span>
      )}

      <motion.div
        className="relative h-full w-full"
        initial={false}
        animate={mode === "play" ? { y: [0, -14, 0, -6, 0], scaleX: dir } : { y: 0, scaleX: dir }}
        transition={{
          y: mode === "play" ? { duration: 0.8, ease: "easeOut" } : { duration: 0.2 },
          scaleX: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={mode === "sleep" ? "sleep" : mode === "sit" ? "sit" : "stand"}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.94, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
            style={{ transformOrigin: "50% 100%" }}
          >
            <ChibiCat mode={mode} coat={coat} face={face} coatPhoto={coatPhoto} id={pet.id} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ChibiCat({
  mode,
  coat,
  face,
  coatPhoto,
  id,
}: {
  mode: Mode;
  coat: [string, string, string, string];
  face: string | null;
  coatPhoto: string | null;
  id: string;
}) {
  const [fur, shade, mark, belly] = coat;
  const safe = id.replace(/[^a-zA-Z0-9]/g, "");
  const body = coatPhoto ? `url(#coat-${safe})` : fur;
  const ink = "#4a3f5c";
  const moving = mode === "walk" || mode === "run";
  const asleep = mode === "sleep";
  const sitting = mode === "sit";

  const vars = {
    "--gait": mode === "run" ? "0.26s" : "0.5s",
    "--wag": sitting ? "1.6s" : "0.9s",
  } as CSSProperties;

  // Sleeping: one curled loaf, head tucked low, tail wrapped around
  if (asleep) {
    return (
      <svg viewBox="0 0 64 48" className="h-full w-full overflow-visible" style={vars}>
        <defs>{coatPhoto && <CoatPattern id={safe} href={coatPhoto} />}</defs>
        <ellipse cx="32" cy="45" rx="22" ry="2.6" fill="rgba(60,70,140,0.14)" />
        <g className="sn-breathe" style={{ transformOrigin: "32px 44px" }}>
          <path d="M10 40 C 8 30, 22 24, 34 26 C 46 26, 54 32, 52 40 C 50 45, 14 46, 10 40 Z" fill={body} stroke={shade} strokeWidth="0.9" />
          <g transform="translate(45 34) rotate(-8)">
            <path d="M-8 -6 L-6 -14 L-1 -8 Z" fill={body} stroke={shade} strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M3 -8 L8 -14 L9 -5 Z" fill={body} stroke={shade} strokeWidth="0.8" strokeLinejoin="round" />
            <circle r="9.5" fill={body} stroke={shade} strokeWidth="0.9" />
            <FaceOrPhoto face={face} r={9.5} safe={safe} />
            {!face && (
              <>
                <path d="M-5 0 q2 1.8 4 0" stroke={ink} strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <path d="M2 0 q2 1.8 4 0" stroke={ink} strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <ellipse cx="-5.5" cy="3.6" rx="2" ry="1.1" fill="#f6a8c2" opacity="0.7" />
                <ellipse cx="6" cy="3.6" rx="2" ry="1.1" fill="#f6a8c2" opacity="0.7" />
              </>
            )}
          </g>
          {/* front paws under the chin */}
          <ellipse cx="38" cy="43" rx="5" ry="2.8" fill={fur} stroke={shade} strokeWidth="0.8" />
          <ellipse cx="46" cy="43.5" rx="4.6" ry="2.6" fill={fur} stroke={shade} strokeWidth="0.8" />
          {/* tail wrapped along the front */}
          <path d="M11 39 C 12 46, 24 46.5, 32 44.5" fill="none" stroke={shade} strokeWidth="5" strokeLinecap="round" />
          <path d="M11 39 C 12 46, 24 46.5, 32 44.5" fill="none" stroke={fur} strokeWidth="3.6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 48" className="h-full w-full overflow-visible" style={vars}>
      <defs>{coatPhoto && <CoatPattern id={safe} href={coatPhoto} />}</defs>
      <ellipse cx="32" cy="46" rx={sitting ? 15 : 19} ry="2.4" fill="rgba(60,70,140,0.14)" />

      {/* tail */}
      <g className="sn-tail" style={{ transformOrigin: sitting ? "18px 42px" : "15px 31px" }}>
        {sitting ? (
          <path d="M18 43 C 9 44, 7 35, 12 30" fill="none" stroke={shade} strokeWidth="5" strokeLinecap="round" />
        ) : (
          <path d="M15 31 C 8 28, 6 20, 11 15" fill="none" stroke={shade} strokeWidth="5" strokeLinecap="round" />
        )}
        {sitting ? (
          <path d="M18 43 C 9 44, 7 35, 12 30" fill="none" stroke={fur} strokeWidth="3.6" strokeLinecap="round" />
        ) : (
          <path d="M15 31 C 8 28, 6 20, 11 15" fill="none" stroke={fur} strokeWidth="3.6" strokeLinecap="round" />
        )}
      </g>

      {/* back legs */}
      {!sitting && (
        <>
          <rect className={moving ? "sn-leg" : ""} x="17" y="35" width="5.5" height="10" rx="2.75" fill={shade} style={{ transformOrigin: "19.75px 36px", animationDelay: `calc(var(--gait) * -0)` }} />
          <rect className={moving ? "sn-leg" : ""} x="35" y="35" width="5.5" height="10" rx="2.75" fill={shade} style={{ transformOrigin: "37.75px 36px", animationDelay: `calc(var(--gait) * -0.75)` }} />
        </>
      )}

      {/* body */}
      <g className={moving ? "sn-bob" : ""}>
        {sitting ? (
          <path d="M17 45 C 13 35, 19 26, 31 26 C 43 26, 49 35, 45 45 Z" fill={body} stroke={shade} strokeWidth="0.9" />
        ) : (
          <ellipse cx="30" cy="31" rx={mode === "run" ? 17.5 : 16} ry="9.5" fill={body} stroke={shade} strokeWidth="0.9" />
        )}
        {!coatPhoto && (
          <>
            <ellipse cx={sitting ? 31 : 32} cy={sitting ? 38 : 34} rx={sitting ? 7 : 9} ry={sitting ? 6.5 : 4.5} fill={belly} opacity="0.85" />
            <path d={sitting ? "M24 30 q2 -2 4 0" : "M22 25 q2 -2.2 4 0 M27 24 q2 -2.2 4 0"} stroke={mark} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
          </>
        )}
      </g>

      {/* front legs */}
      {sitting ? (
        <>
          <rect x="25.5" y="37" width="5.4" height="8.6" rx="2.7" fill={fur} stroke={shade} strokeWidth="0.7" />
          <rect x="31.6" y="37" width="5.4" height="8.6" rx="2.7" fill={fur} stroke={shade} strokeWidth="0.7" />
        </>
      ) : (
        <>
          <rect className={moving ? "sn-leg" : ""} x="21" y="35" width="5.5" height="10" rx="2.75" fill={fur} stroke={shade} strokeWidth="0.7" style={{ transformOrigin: "23.75px 36px", animationDelay: `calc(var(--gait) * -0.5)` }} />
          <rect className={moving ? "sn-leg" : ""} x="39" y="35" width="5.5" height="10" rx="2.75" fill={fur} stroke={shade} strokeWidth="0.7" style={{ transformOrigin: "41.75px 36px", animationDelay: `calc(var(--gait) * -0.25)` }} />
        </>
      )}

      {/* head */}
      <g transform={sitting ? "translate(31 19)" : "translate(46 20)"}>
      <g className={moving ? "sn-bob" : ""}>
        <path d="M-9 -5 L-7.5 -14.5 L-1.5 -9 Z" fill={body} stroke={shade} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M-7.2 -7.5 L-6.6 -12.2 L-3.6 -9.2 Z" fill="#f6b8c8" />
        <path d="M2 -9 L8 -14.5 L9.4 -5 Z" fill={body} stroke={shade} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M3.8 -9.3 L7.2 -12.4 L7.8 -7.6 Z" fill="#f6b8c8" />
        <circle r="11" fill={body} stroke={shade} strokeWidth="0.9" />
        <FaceOrPhoto face={face} r={11} safe={safe} />
        {!face && (
          <>
            {mode === "play" || sitting ? (
              <>
                <path d="M-6 0 q2.2 -2.4 4.4 0" stroke={ink} strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M1.8 0 q2.2 -2.4 4.4 0" stroke={ink} strokeWidth="1.3" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="-3.8" cy="-0.6" rx="1.7" ry="2.1" fill={ink} />
                <ellipse cx="4" cy="-0.6" rx="1.7" ry="2.1" fill={ink} />
                <circle cx="-3.2" cy="-1.3" r="0.6" fill="#fff" />
                <circle cx="4.6" cy="-1.3" r="0.6" fill="#fff" />
              </>
            )}
            <path d="M-1.2 3.4 q1.2 1.2 1.2 0 q0 1.2 1.2 0" stroke={ink} strokeWidth="0.9" fill="none" strokeLinecap="round" />
            <ellipse cx="-7" cy="3.4" rx="2.3" ry="1.3" fill="#f6a8c2" opacity="0.75" />
            <ellipse cx="7.4" cy="3.4" rx="2.3" ry="1.3" fill="#f6a8c2" opacity="0.75" />
          </>
        )}
      </g>
      </g>
    </svg>
  );
}

/** Sample a photo's average colour and build a coat palette from it. */
function usePhotoCoat(url: string | null): [string, string, string, string] | null {
  const [coat, setCoat] = useState<[string, string, string, string] | null>(null);
  useEffect(() => {
    if (!url) return setCoat(null);
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        // centre crop: the fur, not the background
        const s = Math.min(img.width, img.height) * 0.6;
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        const base = [r / n, g / n, b / n];
        const mix = (k: number, t: number) =>
          "#" + base.map((v) => Math.round(Math.max(0, Math.min(255, v + (t - v) * k))).toString(16).padStart(2, "0")).join("");
        if (alive) setCoat([mix(0.08, 255), mix(0.22, 0), mix(0.4, 0), mix(0.45, 255)]);
      } catch {
        /* CORS-blocked image: keep the default coat */
      }
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return coat;
}

function CoatPattern({ id, href }: { id: string; href: string }) {
  return (
    <pattern id={`coat-${id}`} patternUnits="userSpaceOnUse" width="64" height="48">
      <image href={href} width="64" height="48" preserveAspectRatio="xMidYMid slice" />
    </pattern>
  );
}

function FaceOrPhoto({ face, r, safe }: { face: string | null; r: number; safe: string }) {
  if (!face) return null;
  return (
    <>
      <clipPath id={`face-${safe}`}>
        <circle r={r - 1} />
      </clipPath>
      <image href={face} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#face-${safe})`} preserveAspectRatio="xMidYMid slice" />
    </>
  );
}
