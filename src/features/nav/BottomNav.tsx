import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Calendar, BookHeart, PinIcon, Star, Cat } from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABS: { key: TabKey; icon: React.ReactNode; dotKinds?: string[] }[] = [
  { key: "home",     icon: <Home size={22} strokeWidth={1.6} /> },
  { key: "calendar", icon: <Calendar size={22} strokeWidth={1.6} />, dotKinds: ["event", "memory"] },
  { key: "memories", icon: <BookHeart size={22} strokeWidth={1.6} />, dotKinds: ["album_item"] },
  { key: "wall",     icon: <PinIcon size={22} strokeWidth={1.6} />, dotKinds: ["note"] },
  { key: "stickers", icon: <Star size={22} strokeWidth={1.6} />, dotKinds: ["sticker"] },
  { key: "pet",      icon: <Cat size={22} strokeWidth={1.6} />, dotKinds: ["pet"] },
];

const SPEECH_MESSAGES: Record<string, string[]> = {
  home: [
    "Hope you're having a warm day! Send a hug!",
    "I love sitting here with you.",
    "Mrow! You two are so sweet together!",
  ],
  calendar: [
    "Let's look at our memories calendar & timeline!",
    "All our happy milestones and moments together!",
    "Our love timeline is so beautiful!",
  ],
  memories: [
    "Let's flip through our photo album!",
    "Decorate our pages with stickers and polaroids!",
    "Our love album is a book of us!",
  ],
  wall: [
    "Leave a sweet note on our Love Wall!",
    "Cute polaroids make me purr.",
    "I love reading your soft words.",
  ],
  stickers: [
    "Your sticker sheet is so cute!",
    "Let's add more custom stickers!",
    "Mocha loves these outlines!",
  ],
  pet: [
    "Mrow! Let's name more pets!",
    "Adopt more cute kittens!",
    "Welcome to the pet sanctuary!",
  ]
};

const COLOR_MAP: Record<string, string> = {
  orange: "#ffe0b2",
  black:  "#cfd8dc",
  white:  "#fafafa",
};

const parseVariant = (variantStr: string | null) => {
  if (!variantStr) {
    return { faceMode: "cartoon", patternMode: "color", patternColor: "orange" };
  }
  const [faceMode, patternMode, patternColor] = variantStr.split(":");
  return {
    faceMode: faceMode || "cartoon",
    patternMode: patternMode || "color",
    patternColor: patternColor || "orange",
  };
};

type PetBehavior = "walk" | "sit" | "sleep" | "play";
type PetSpeed = "slow" | "normal" | "fast";

export function BottomNav({ relationshipId }: { relationshipId?: string }) {
  const { tab, setTab, activeRoamingPetIds, isPetVisible } = useAppStore();
  const { list } = useNotifications(relationshipId);

  // Query details of all active roaming pets
  const { data: roamingPets = [] } = useQuery({
    queryKey: ["roaming-pets", activeRoamingPetIds],
    queryFn: async () => {
      if (activeRoamingPetIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pets")
        .select("id,name,photos,variant")
        .in("id", activeRoamingPetIds);
      if (error) throw error;
      return data || [];
    },
    enabled: activeRoamingPetIds.length > 0,
  });

  const unreadByKind = list.reduce<Record<string, number>>((m, n) => {
    if (!n.read) m[n.kind] = (m[n.kind] ?? 0) + 1;
    return m;
  }, {});

  const petPositionsRef = useRef<Record<string, number>>({});

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className="relative flex w-full max-w-md flex-col pointer-events-auto">
        
        {/* Style block for animations */}
        <style>{`
          @keyframes pet-tail-wag {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(10deg); }
          }
          @keyframes pet-tail-wag-fast {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(18deg); }
          }
          @keyframes pet-leg-swing-1 {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(10deg); }
          }
          @keyframes pet-leg-swing-2 {
            0%, 100% { transform: rotate(10deg); }
            50% { transform: rotate(-10deg); }
          }
          @keyframes pet-sleeping-breath {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.92); }
          }
          .pet-walking-leg-1 {
            animation: pet-leg-swing-1 var(--swing-dur, 0.55s) infinite ease-in-out;
            transform-origin: 50% 25%;
          }
          .pet-walking-leg-2 {
            animation: pet-leg-swing-2 var(--swing-dur, 0.55s) infinite ease-in-out;
            transform-origin: 50% 25%;
          }
          .pet-tail {
            animation: pet-tail-wag var(--wag-dur, 0.8s) infinite ease-in-out;
            transform-origin: 10% 90%;
          }
          .pet-tail-play {
            animation: pet-tail-wag-fast 0.3s infinite ease-in-out;
            transform-origin: 10% 90%;
          }
          .pet-body-sleep {
            animation: pet-sleeping-breath 1.8s infinite ease-in-out;
            transform-origin: center bottom;
          }
          .pet-hop-anim {
            animation: pet-hop-key 0.6s ease-in-out;
          }
          @keyframes pet-hop-key {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          @keyframes floating-z {
            0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
            50% { opacity: 0.8; }
            100% { transform: translate(6px, -15px) scale(1.1); opacity: 0; }
          }
          .float-zzz {
            animation: floating-z 2.2s infinite linear;
          }
        `}</style>

        {/* ── Navbar Menu Capsule ── */}
        <div className="relative flex w-full items-stretch justify-between rounded-full border border-white/40 bg-white/40 backdrop-blur-2xl px-2 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_18px_50px_-20px_rgba(80,110,160,0.45)] z-30">
          
          {isPetVisible && roamingPets.map((p, idx) => (
            <RoamingPet 
              key={p.id} 
              pet={p} 
              otherPets={roamingPets} 
              index={idx}
              tab={tab}
              petPositionsRef={petPositionsRef}
            />
          ))}

          {TABS.map((t) => {
            const active = tab === t.key;
            const dot = t.dotKinds?.some((k) => (unreadByKind[k] ?? 0) > 0);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="relative flex flex-1 items-center justify-center rounded-full py-3"
                aria-label={t.key}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),rgba(255,255,255,0.25)_65%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_6px_18px_-8px_rgba(80,110,160,0.35)]"
                  />
                )}
                <span className={`relative z-10 transition-colors ${active ? "text-foreground" : "text-foreground/45"}`}>
                  {t.icon}
                  {dot && !active && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--hug)] shadow-[0_0_6px_var(--hug)]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function RoamingPet({ 
  pet, otherPets, index, tab, petPositionsRef 
}: { 
  pet: any; 
  otherPets: any[]; 
  index: number; 
  tab: TabKey;
  petPositionsRef: React.MutableRefObject<Record<string, number>>;
}) {
  const [posX, setPosX] = useState(() => 15 + index * 20);
  const [direction, setDirection] = useState(() => (index % 2 === 0 ? 1 : -1));
  const [behavior, setBehavior] = useState<PetBehavior>("walk");
  const [speed, setSpeed] = useState<PetSpeed>("normal");
  const [isHopping, setIsHopping] = useState(false);
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isManuallySleeping, setIsManuallySleeping] = useState(false);

  const lastInteractionTime = useRef(0);
  const pointerStartTime = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    petPositionsRef.current[pet.id] = posX;
  }, [posX, pet.id]);

  useEffect(() => {
    if (isManuallySleeping) return; // Keep sleep peace
    const msgs = SPEECH_MESSAGES[tab] || ["Mrow!"];
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
    setBubbleText(randomMsg);
    setBubbleVisible(true);
    const timer = setTimeout(() => setBubbleVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [tab, isManuallySleeping]);

  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount++;

      // Lock behavior if manually put to sleep
      if (isManuallySleeping) {
        return;
      }

      // Every 100 ticks (6 seconds), check for a random behavior/speed change
      if (tickCount >= 100) {
        tickCount = 0;
        const rand = Math.random();
        if (rand < 0.35) {
          setBehavior(Math.random() < 0.65 ? "sit" : "sleep");
        } else {
          setBehavior("walk");
          const speeds: PetSpeed[] = ["slow", "normal", "fast"];
          setSpeed(speeds[Math.floor(Math.random() * speeds.length)]);
        }
      }

      if (behavior === "play") {
        if (tickCount >= 33) {
          setBehavior("walk");
          tickCount = 0;
        }
      }

      // Check for interactions with other pets
      if (otherPets.length > 1 && Date.now() - lastInteractionTime.current > 15000) {
        otherPets.forEach((op) => {
          if (op.id === pet.id) return;
          const opPos = petPositionsRef.current[op.id];
          if (opPos !== undefined) {
            const dist = Math.abs(posX - opPos);
            if (dist < 6) {
              lastInteractionTime.current = Date.now();
              setBehavior("sit");
              setDirection(opPos > posX ? 1 : -1);
              
              const greetings = [
                `Hi ${op.name}!`,
                "Prrrt!",
                "Sniff sniff...",
                "Let's play!",
                "Purrr..."
              ];
              setBubbleText(greetings[Math.floor(Math.random() * greetings.length)]);
              setBubbleVisible(true);
              setTimeout(() => setBubbleVisible(false), 3000);

              setTimeout(() => {
                setIsHopping(true);
                setBehavior("play");
                setTimeout(() => setIsHopping(false), 600);
              }, 1200);
            }
          }
        });
      }

      if (behavior === "walk") {
        setPosX((x) => {
          let step = 0.28;
          if (speed === "slow") step = 0.15;
          if (speed === "fast") step = 0.52;

          let newX = x + direction * step;
          if (newX >= 86) {
            setDirection(-1);
            return 86;
          }
          if (newX <= 6) {
            setDirection(1);
            return 6;
          }
          return newX;
        });
      }
    }, 60);

    return () => {
      clearInterval(interval);
      delete petPositionsRef.current[pet.id];
    };
  }, [behavior, speed, direction, otherPets, pet.id, isManuallySleeping]);

  const handlePetClick = () => {
    // Wake up trigger
    if (isManuallySleeping) {
      setIsManuallySleeping(false);
      setBehavior("walk");
      setSpeed("normal");
      setIsHopping(true);
      setTimeout(() => setIsHopping(false), 600);

      setBubbleText("Good morning!");
      setBubbleVisible(true);
      setTimeout(() => setBubbleVisible(false), 2000);
      return;
    }

    setIsHopping(true);
    setBehavior("play");
    setTimeout(() => setIsHopping(false), 600);

    const meows = [
      "Meow!", 
      "Purrr...", 
      "Prrrt?", 
      "Mrow! Happy to play!", 
      "I love you, meow!"
    ];
    const randomMeow = meows[Math.floor(Math.random() * meows.length)];
    setBubbleText(randomMeow);
    setBubbleVisible(true);
    setTimeout(() => setBubbleVisible(false), 3500);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartTime.current = Date.now();
    longPressTimer.current = setTimeout(() => {
      setBehavior("sleep");
      setSpeed("slow");
      setIsManuallySleeping(true); // LOCK SLEEP
      setBubbleText("Good night...");
      setBubbleVisible(true);
      setTimeout(() => setBubbleVisible(false), 2000);
      longPressTimer.current = null;
    }, 800);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      if (Date.now() - pointerStartTime.current < 800) {
        handlePetClick();
      }
    }
  };

  const config = parseVariant(pet.variant);
  const isPhotoFace = config.faceMode === "photo";
  
  const faceUrl = pet.photos && pet.photos.length > 0 && pet.photos[0] ? pet.photos[0] : null;
  const patternUrl = config.patternMode === "photo" && pet.photos && pet.photos.length > 1 && pet.photos[1] ? pet.photos[1] : null;

  return (
    <div 
      className="absolute bottom-full mb-[-5px] w-[58px] h-[46px] z-40 flex items-end justify-center pointer-events-auto cursor-pointer select-none touch-none"
      style={{ left: `${posX}%`, transform: "translateX(-50%)" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }}
    >
      {behavior === "sleep" && (
        <span className="absolute -top-3.5 right-0.5 text-[9px] font-bold text-primary/75 float-zzz select-none pointer-events-none">Zzz</span>
      )}

      {/* Lightweight, semi-transparent glassmorphic speech bubble to prevent overlapping blockiness */}
      <AnimatePresence>
        {bubbleVisible && bubbleText && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-28 bg-white/70 backdrop-blur-md border border-white/40 px-2 py-1 rounded-xl shadow-md text-[9px] text-foreground font-semibold text-center leading-tight animate-in fade-in slide-in-from-bottom-2 duration-200 select-none pointer-events-none z-50">
            {bubbleText}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/70" />
          </div>
        )}
      </AnimatePresence>

      <div 
        style={{ transform: `scaleX(${direction})` }}
        className="w-full h-full flex items-end justify-center"
      >
        <AnimatedKitten 
          behavior={behavior} 
          speed={speed} 
          isHopping={isHopping} 
          faceUrl={faceUrl} 
          patternUrl={patternUrl}
          isPhotoFace={isPhotoFace}
          patternColor={config.patternColor}
        />
      </div>
    </div>
  );
}

// Render clean, outline-free cat vector shapes with soft pastel fills
function AnimatedKitten({ 
  behavior, speed, isHopping, faceUrl, patternUrl, isPhotoFace, patternColor 
}: { 
  behavior: PetBehavior; 
  speed: PetSpeed; 
  isHopping: boolean; 
  faceUrl: string | null; 
  patternUrl: string | null;
  isPhotoFace: boolean;
  patternColor: string;
}) {
  const isWalking = behavior === "walk";
  const isSleeping = behavior === "sleep";
  const isSitting = behavior === "sit";

  let swingDuration = "0.55s";
  let wagDuration = "0.8s";
  if (speed === "slow") {
    swingDuration = "0.8s";
    wagDuration = "1.2s";
  } else if (speed === "fast") {
    swingDuration = "0.35s";
    wagDuration = "0.5s";
  }

  const customStyles = {
    "--swing-dur": swingDuration,
    "--wag-dur": wagDuration,
  } as React.CSSProperties;

  const hasPattern = !!patternUrl;
  const mainFill = hasPattern ? "url(#cat-coat-pattern)" : (COLOR_MAP[patternColor] || COLOR_MAP.orange);
  const mainStroke = hasPattern ? "url(#cat-coat-pattern)" : (COLOR_MAP[patternColor] || COLOR_MAP.orange);

  // ── RENDER SITTING POSTURE (Matching Pear-Shaped Reference Silhouette!) ──
  if (isSitting) {
    return (
      <svg
        width="58"
        height="46"
        viewBox="0 0 38 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isHopping ? "pet-hop-anim" : ""}
      >
        <defs>
          {/* Unified coat pattern ID so photo pattern renders correctly when sitting! */}
          {hasPattern && (
            <pattern id="cat-coat-pattern" x="0" y="0" width="38" height="30" patternUnits="userSpaceOnUse">
              <image href={patternUrl} x="0" y="0" width="38" height="30" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          <clipPath id="head-clip-circle-sit">
            <circle cx="18.5" cy="8.5" r="6.5" />
          </clipPath>
        </defs>

        {/* Upright S-Tail on Left Side matching reference silhouette */}
        <path
          d="M 13 24 Q 6 22, 7 17 T 11 11 Q 12 8, 10 6"
          stroke={mainStroke}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Centered front paws */}
        <line x1="17" y1="23" x2="17" y2="27" stroke={mainStroke} strokeWidth="2.8" strokeLinecap="round" />
        <line x1="20" y1="23" x2="20" y2="27" stroke={mainStroke} strokeWidth="2.8" strokeLinecap="round" />

        {/* Sitting Back leg tuck */}
        <path
          d="M 21 21 C 23 21, 24.5 24, 23 27"
          stroke={mainStroke}
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Pear-shaped sitting body outline */}
        <path
          d="M 13 23 C 12 18, 14 13, 15 11 C 15 11, 16 11, 22 11 C 23 13, 25 18, 24 23 C 23 25, 22 26, 21 26 L 16 26 C 15 26, 14 25, 13 23 Z"
          fill={mainFill}
        />

        {/* Head Group */}
        <g>
          {/* Round ears (No borders) */}
          <path
            d="M 13 6 C 13 3, 14 0.5, 15 0.5 C 16 0.5, 16.5 3, 17 4.5"
            fill={mainFill}
          />
          <path
            d="M 20 4.5 C 20.5 3, 21 0.5, 22 0.5 C 23 0.5, 24 3, 24 6"
            fill={mainFill}
          />

          {/* Head Circle or Custom Cropped Cat Face Photo */}
          {faceUrl && isPhotoFace ? (
            <>
              <circle cx="18.5" cy="8.5" r="6.75" fill="white" />
              <image
                href={faceUrl}
                x="12"
                y="2"
                width="13"
                height="13"
                clipPath="url(#head-clip-circle-sit)"
              />
            </>
          ) : (
            <circle cx="18.5" cy="8.5" r="6.5" fill={mainFill} />
          )}

          {/* Eyes, Mouth, Whiskers (Cartoon) */}
          {(!faceUrl || !isPhotoFace) && (
            <>
              <path d="M 16.5 9 L 17.5 7.5 L 18.5 9" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 20.5 9 L 21.5 7.5 L 22.5 9" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 18 11 Q 18.75 12, 19.5 11 Q 20.25 12, 21 11" stroke="oklch(0.2 0.02 60)" strokeWidth="0.6" strokeLinecap="round" fill="none" />
              <circle cx="19.5" cy="10.2" r="0.5" fill="#ff80ab" />

              {/* Whiskers (Left side) */}
              <line x1="16" y1="10.2" x2="13.5" y2="9.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
              <line x1="16" y1="10.8" x2="13.5" y2="11.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />

              {/* Whiskers (Right side) */}
              <line x1="23" y1="10.2" x2="25.5" y2="9.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
              <line x1="23" y1="10.8" x2="25.5" y2="11.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
            </>
          )}
        </g>
      </svg>
    );
  }

  // ── RENDER STANDARD HORIZONTAL STANCE (Walk, Sleep, Play) ──
  return (
    <svg
      width="58"
      height="46"
      viewBox="0 0 38 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={isHopping ? "pet-hop-anim" : ""}
      style={customStyles}
    >
      <defs>
        {hasPattern && (
          <pattern id="cat-coat-pattern" x="0" y="0" width="38" height="30" patternUnits="userSpaceOnUse">
            <image href={patternUrl} x="0" y="0" width="38" height="30" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        <clipPath id="head-clip-circle">
          <circle cx="29" cy="9.5" r="6.5" />
        </clipPath>
      </defs>

      {/* Shorter open S-curve tail */}
      <path
        className={behavior === "play" ? "pet-tail-play" : "pet-tail"}
        d="M 8 20 Q 3.5 17, 4.5 14 T 8 9 Q 10 7.5, 9 6"
        stroke={mainStroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Back Leg (Far side) */}
      {!isSleeping && (
        <>
          <line
            className={isWalking ? "pet-walking-leg-2" : ""}
            x1="12" y1="21" x2="10" y2="27"
            stroke="oklch(0.55 0.05 240 / 0.12)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <line
            className={isWalking ? "pet-walking-leg-2" : ""}
            x1="12" y1="21" x2="10" y2="27"
            stroke={mainStroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            className={isWalking ? "pet-walking-leg-1" : ""}
            x1="26" y1="21" x2="28" y2="27"
            stroke={mainStroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Torso/Body */}
      <rect
        x="8"
        y="11"
        width="21"
        height="12"
        rx="5.5"
        fill={mainFill}
        className={isSleeping ? "pet-body-sleep" : ""}
      />

      {/* Front Leg (Near side) */}
      {!isSleeping ? (
        <>
          <line
            className={isWalking ? "pet-walking-leg-1" : ""}
            x1="14" y1="21" x2="15" y2="27"
            stroke={mainStroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            className={isWalking ? "pet-walking-leg-2" : ""}
            x1="24" y1="21" x2="23" y2="27"
            stroke={mainStroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : (
        /* Sleeping paws tucked under body */
        <>
          <line x1="13" y1="23" x2="16" y2="23" stroke={mainStroke} strokeWidth="3" strokeLinecap="round" />
          <line x1="21" y1="23" x2="24" y2="23" stroke={mainStroke} strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {/* Head Group */}
      <g className={isSleeping ? "pet-body-sleep animate-pulse" : ""}>
        {/* Round ears (No borders) */}
        <path
          d="M 23.5 7 C 23.5 4, 24.5 1.5, 25.5 1.5 C 26.5 1.5, 27 4, 27.5 6"
          fill={mainFill}
        />
        <path
          d="M 30.5 6 C 31 4, 31.5 1.5, 32.5 1.5 C 33.5 1.5, 34.5 4, 34.5 7"
          fill={mainFill}
        />

        {/* Head Circle or Custom Cropped Cat Face Photo */}
        {faceUrl && isPhotoFace ? (
          <>
            <circle cx="29" cy="9.5" r="6.75" fill="white" />
            <image
              href={faceUrl}
              x="22.5"
              y="3"
              width="13"
              height="13"
              clipPath="url(#head-clip-circle)"
            />
          </>
        ) : (
          <circle
            cx="29"
            cy="9.5"
            r="6.5"
            fill={mainFill}
          />
        )}

        {/* Eyes, Mouth, and Whiskers (Only if not photo face) */}
        {(!faceUrl || !isPhotoFace) && (
          <>
            {isSleeping ? (
              <>
                <path d="M 27 8.5 Q 28 9.5 29 8.5" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                <path d="M 31 8.5 Q 32 9.5 33 8.5" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" fill="none" />
                <path d="M 29.2 11 Q 30 11.5 30.8 11" stroke="oklch(0.2 0.02 60)" strokeWidth="0.6" strokeLinecap="round" fill="none" />

                {/* Sleeping Whiskers (Left side) */}
                <line x1="26" y1="10.2" x2="23.5" y2="9.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
                <line x1="26" y1="10.8" x2="23.5" y2="11.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />

                {/* Sleeping Whiskers (Right side) */}
                <line x1="33" y1="10.2" x2="35.5" y2="9.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
                <line x1="33" y1="10.8" x2="35.5" y2="11.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
              </>
            ) : (
              <>
                {/* Thin stroke ^ w ^ face */}
                <path d="M 27 10 L 28 8.5 L 29 10" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M 31 10 L 32 8.5 L 33 10" stroke="oklch(0.2 0.02 60)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M 28.5 12 Q 29.25 13 30 12 Q 30.75 13 31.5 12" stroke="oklch(0.2 0.02 60)" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                <circle cx="30" cy="11.2" r="0.5" fill="#ff80ab" />

                {/* Awake Whiskers (Left side) */}
                <line x1="26" y1="11.2" x2="23.5" y2="10.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
                <line x1="26" y1="11.8" x2="23.5" y2="12.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />

                {/* Awake Whiskers (Right side) */}
                <line x1="33" y1="11.2" x2="35.5" y2="10.8" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
                <line x1="33" y1="11.8" x2="35.5" y2="12.3" stroke="white" strokeWidth="0.6" strokeLinecap="round" />
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
}
