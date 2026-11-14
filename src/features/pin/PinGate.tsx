import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Play, Download, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isAnniversaryMatch, pinStorage, type Slot } from "./pin-utils";
import { PinKeypad } from "./PinKeypad";
import { useAppStore } from "@/features/app/store";
import { ART } from "@/components/seanaya/art";
import { useCoupleNames } from "@/hooks/useCouple";

type Stage =
  | "loading"
  | "error"
  | "setup-name" // no space yet — first user (creator)
  | "setup-pin"
  | "setup-confirm"
  | "partner-name" // Page 1: Greeting + Voice Message
  | "partner-name-input" // Page 2: Name Onboarding
  | "partner-pin"
  | "partner-confirm"
  | "unlock" // both PINs exist → PIN pad
  | "unlocked";

type SpaceState = {
  id: string;
  name: string | null;
  name_a: string | null;
  name_b: string | null;
  has_a: boolean;
  has_b: boolean;
};

const COMPLIMENT_WORDS = [
  "loving",
  "caring",
  "gorgeous",
  "beautiful",
  "sweet",
  "precious",
  "adorable",
  "charming",
  "wonderful",
  "amazing",
  "perfect",
  "cutest",
  "loveliest",
  "dearly loved",
  "stunning",
  "pretty",
  "breathtaking",
  "angelic",
  "sweetest",
  "irresistible",
  "one-and-only",
  "extraordinary",
  "magical",
  "marvelous",
  "captivating",
  "magnificent",
];

const sentenceVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const letterVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      damping: 12,
      stiffness: 150,
    },
  },
};

function EqVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const BAR_COUNT = 15;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Focus only on the voice-frequency bands (lower 40% of the spectrum) to keep all bars alive
      const activeBins = Math.floor(bufferLength * 0.4);
      const step = Math.max(1, Math.floor(activeBins / BAR_COUNT));
      const barW = 4; // Spotify-style round pill width
      const spacing = 3;
      const totalWidth = BAR_COUNT * (barW + spacing) - spacing;
      const startX = (W - totalWidth) / 2; // Center the waveform horizontally
      const centerY = H / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Average a small band of frequency bins per bar
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
        const avg = sum / step;

        // Symmetrical audio capsule height (min 4px so it outlines nicely when silent)
        const barH = Math.max(4, (avg / 255) * H * 0.85);

        const x = startX + i * (barW + spacing);
        const y = centerY - barH / 2;

        // Gradient: bottom primary blue, top white glow
        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, "rgba(120,148,232,0.95)"); // Periwinkle
        grad.addColorStop(1, "rgba(255,255,255,0.95)"); // White glow

        ctx.fillStyle = grad;
        ctx.beginPath();
        // Symmetrical rounded caps (capsule shape)
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      }
    };
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={56}
      className="my-3 rounded"
      style={{ imageRendering: "pixelated" }}
    />
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
    { top: "70%", left: "5%", delay: 1.1, scale: 0.5 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {sparkles.map((s, idx) => (
        <motion.svg
          key={idx}
          animate={{
            opacity: [0.12, 0.45, 0.12],
            scale: [s.scale * 0.8, s.scale * 1.2, s.scale * 0.8],
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.delay,
          }}
          style={{ top: s.top, left: s.left }}
          className="absolute w-3 h-3 text-white/40"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
        </motion.svg>
      ))}
    </div>
  );
}

/**
 * Two-PIN model:
 *   - Space (relationship) has pin_hash_a and pin_hash_b + name_a/name_b.
 *   - Creator sets slot A. Second visitor is auto-recognized and sets slot B.
 *   - After both slots exist, ANY device on ANY visit shows the PIN pad only.
 *     Entering PIN A → active slot A; entering PIN B → active slot B.
 *   - Slot ownership (user_a_id/user_b_id) is claimed by the current anon
 *     auth uid via the claim_slot RPC — so a phone switch just re-claims.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [space, setSpace] = useState<SpaceState | null>(null);
  const [name, setName] = useState(pinStorage.getName() ?? "");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  // Ref for the lily confetti canvas overlay
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Playback States
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isVmPlaying, setIsVmPlaying] = useState(false);
  const [hasVmPlayed, setHasVmPlayed] = useState(false);

  // Index for cycling compliment words on Page 2
  const [wordIndex, setWordIndex] = useState(0);

  // Audio references
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const voiceMessageRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio API analyser for real-time EQ
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const refreshSpace = async (): Promise<SpaceState | null> => {
    const { data, error } = await supabase.rpc("get_space_state");
    if (error) {
      console.error("[PinGate] refreshSpace error:", error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const s: SpaceState = row as SpaceState;
    setSpace(s);
    pinStorage.setRel(s.id);
    return s;
  };

  const initApp = async () => {
    // Local development only: production builds ignore ?preview=true.
    const urlPreview =
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview");
    if (urlPreview === "true") {
      pinStorage.setSlot("a");
      pinStorage.setName("Sean");
      pinStorage.setRel("cdb0c647-18fe-4e07-9d90-66b83298bc47");
      setStage("unlocked");
      return;
    }

    setStage("loading");
    setErrorMsg(null);
    try {
      // Verify if session is valid in Supabase
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        // Clear any stale local auth state if invalid
        await supabase.auth.signOut().catch(() => {});
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          console.error("Sign in anonymously failed:", anonError);
          setErrorMsg("Waking up space database...");
          setStage("error");
          return;
        }
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_space_state");
      if (rpcError) {
        console.error("get_space_state error:", rpcError);
        setErrorMsg("Connecting to your space...");
        setStage("error");
        return;
      }

      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const s: SpaceState | null = (row as SpaceState) ?? null;
      if (s) {
        setSpace(s);
        pinStorage.setRel(s.id);
      }

      const urlInvite = new URLSearchParams(window.location.search).get("invite");

      if (!s) {
        setStage("setup-name");
      } else if (s.has_a && s.has_b) {
        setStage("unlock");
      } else if (s.has_a && !s.has_b) {
        if (urlInvite) {
          setStage("partner-name");
        } else {
          setStage("unlock");
        }
      } else {
        setStage("setup-name");
      }
    } catch (err: any) {
      console.error("Initialization error:", err);
      setErrorMsg(err.message || "Connection error");
      setStage("error");
    }
  };

  useEffect(() => {
    initApp();
  }, [retryCount]);

  // Auto-retry when in error stage every 4 seconds
  useEffect(() => {
    if (stage !== "error") return;
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
    }, 4000);
    return () => clearTimeout(timer);
  }, [stage, retryCount]);

  // Cycle compliment words on Page 2
  useEffect(() => {
    if (stage !== "partner-name-input") return;
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % COMPLIMENT_WORDS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [stage]);

  // Cleanup audios when leaving the page or component unmounts
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      if (voiceMessageRef.current) {
        voiceMessageRef.current.pause();
        voiceMessageRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (stage !== "partner-name") {
      if (bgMusicRef.current) bgMusicRef.current.pause();
      if (voiceMessageRef.current) {
        voiceMessageRef.current.pause();
        setIsVmPlaying(false);
      }
    }
  }, [stage]);

  // Effect to trigger white lily poppers upon partner-name landing (80 total lilies, Canvas animated for extreme smoothness)
  useEffect(() => {
    if (stage !== "partner-name") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle canvas sizing
    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const stickerSources = [
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
    const loadedImages = stickerSources.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    const list: {
      x: number; // percentage
      y: number; // percentage
      vx: number;
      vy: number;
      rotation: number;
      rotationSpeed: number;
      scale: number;
      opacity: number;
      imgIdx: number;
      delay: number;
    }[] = [];

    // Left Popper Lilies (40)
    for (let i = 0; i < 40; i++) {
      list.push({
        x: -5 + Math.random() * 12,
        y: 100,
        vx: 0.4 + Math.random() * 1.1,
        vy: -1.8 - Math.random() * 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: -2 + Math.random() * 4,
        scale: 0.45 + Math.random() * 0.4,
        opacity: 1,
        imgIdx: Math.floor(Math.random() * loadedImages.length),
        delay: Math.random() * 95,
      });
    }

    // Right Popper Lilies (40)
    for (let i = 0; i < 40; i++) {
      list.push({
        x: 93 + Math.random() * 12,
        y: 100,
        vx: -0.4 - Math.random() * 1.1,
        vy: -1.8 - Math.random() * 1.5,
        rotation: Math.random() * 360,
        rotationSpeed: -2 + Math.random() * 4,
        scale: 0.45 + Math.random() * 0.4,
        opacity: 1,
        imgIdx: Math.floor(Math.random() * loadedImages.length),
        delay: Math.random() * 95,
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

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
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

        // Draw particle
        const xPx = (p.x / 100) * canvas.width;
        const yPx = (p.y / 100) * canvas.height;
        const size = 100 * p.scale;

        ctx.save();
        ctx.translate(xPx, yPx);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.drawImage(loadedImages[p.imgIdx], -size / 2, -size / 2, size, size);
        ctx.restore();
      }

      if (allDead) {
        active = false;
      } else {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);

    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
    };
  }, [stage]);

  // Wire an HTMLAudioElement through Web Audio API and return an AnalyserNode
  const connectAnalyser = (el: HTMLAudioElement): AnalyserNode => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128; // 64 frequency bins — lightweight & smooth
    analyser.smoothingTimeConstant = 0.82; // nice smoothing between frames
    const source = ctx.createMediaElementSource(el);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    return analyser;
  };

  // Audio Activation & Tap Screen Continue Trigger
  const handleScreenTap = () => {
    if (stage !== "partner-name") return;

    if (!hasInteracted) {
      setHasInteracted(true);
      try {
        // Play Romantic Background Entrance Music
        const bg = new Audio(
          "https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-12.mp3",
        );
        bg.loop = true;
        bg.volume = 0.22;
        bgMusicRef.current = bg;
        bg.play().catch((err) => console.log("BG Music Autoplay blocked:", err));

        // Play Voice Message — routed through Web Audio API for real-time EQ
        const vm = new Audio("/voice-message.mp3");
        vm.volume = 1.0;
        vm.crossOrigin = "anonymous";
        voiceMessageRef.current = vm;

        const analyser = connectAnalyser(vm);
        setAnalyserNode(analyser);

        setIsVmPlaying(true);
        vm.play().catch((err) => console.log("Voice Message Autoplay blocked:", err));

        vm.onended = () => {
          setIsVmPlaying(false);
          setHasVmPlayed(true);
        };
      } catch (e) {
        console.error("Audio initialization error:", e);
      }
    } else {
      // If already interacted:
      // If voice message is playing, tap to pause/stop it and show controls (Listen Again & Save voice message)
      if (isVmPlaying && voiceMessageRef.current) {
        voiceMessageRef.current.pause();
        setIsVmPlaying(false);
        setHasVmPlayed(true);
      } else {
        // If voice message is finished or already paused, tapping anywhere continues to the name input page
        setStage("partner-name-input");
      }
    }
  };

  const handleReplayVm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voiceMessageRef.current) {
      // Resume AudioContext if it was suspended (iOS/mobile policy)
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume();
      }
      voiceMessageRef.current.currentTime = 0;
      setIsVmPlaying(true);
      voiceMessageRef.current.play().catch((err) => console.error(err));

      voiceMessageRef.current.onended = () => {
        setIsVmPlaying(false);
        setHasVmPlayed(true);
      };
    }
  };

  const handleDownloadVm = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = "/voice-message.mp3";
    link.download = "voice-message.mp3";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------- Setup slot A (creator) --------
  async function completeSetup(finalPin: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const hash = await hashPin(finalPin);
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: rel, error } = await supabase
        .from("relationships")
        .insert({
          user_a_id: u.user.id,
          invite_code: code,
          name: name.trim() || "Seanaya",
          name_a: name.trim() || null,
          pin_hash_a: hash,
        })
        .select("id")
        .single();

      if (error) {
        toast.error("Could not create your space");
        return;
      }
      pinStorage.setName(name.trim());
      pinStorage.setRel(rel.id);
      pinStorage.setSlot("a");
      pinStorage.setInvite(code);
      await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() });

      const inviteLink = `${window.location.origin}/?invite=${code}`;
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        navigator.clipboard.writeText(inviteLink).catch(() => {});
      }
      toast.success("Your space is ready. Invite link copied.", { duration: 6000 });

      setStage("unlocked");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong");
    }
  }

  // -------- Setup slot B (partner) --------
  async function completePartnerSetup(finalPin: string) {
    try {
      const urlInvite = new URLSearchParams(window.location.search).get("invite");
      if (!space || !urlInvite) return;
      const hash = await hashPin(finalPin);
      const { error } = await supabase.rpc("set_partner_pin", {
        _rel_id: space.id,
        _pin_hash: hash,
        _name: name.trim() || "partner",
        _invite: urlInvite,
      } as any);
      if (error) {
        toast.error(
          error.message.includes("different pin")
            ? "Pick a different PIN than your partner"
            : "Could not join space",
        );
        return;
      }

      pinStorage.setSlot("b");
      const { data: u } = await supabase.auth.getUser();
      if (u.user)
        await supabase
          .from("profiles")
          .upsert({ id: u.user.id, display_name: name.trim() || "partner" });

      setStage("unlocked");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong");
    }
  }

  // -------- Returning: enter PIN → resolve slot --------
  async function tryUnlock(input: string) {
    try {
      if (!space) return;
      const hash = await hashPin(input);
      const { data, error } = await supabase.rpc("claim_slot", {
        _rel_id: space.id,
        _pin_hash: hash,
      });
      if (data === "locked") {
        setPin("");
        toast.error("Too many tries. Wait a few minutes, then try again.");
        return;
      }
      if (error || !data || (data !== "a" && data !== "b")) {
        setPin("");
        toast.error("PIN doesn't match");
        return;
      }
      const slot = data as Slot;
      pinStorage.setSlot(slot);
      const label = slot === "a" ? space.name_a || "you" : space.name_b || "you";
      pinStorage.setName(label);

      setStage("unlocked");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong");
    }
  }

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stage === "partner-name-input") setStage("partner-name");
    else if (stage === "partner-pin") setStage("partner-name-input");
    else if (stage === "partner-confirm") setStage("partner-pin");
  };

  if (stage === "unlocked") return <>{children}</>;

  const showTapCursor = stage === "partner-name";

  return (
    <div
      onClick={handleScreenTap}
      className={`fixed inset-0 flex items-center justify-center overflow-hidden select-none ${showTapCursor ? "cursor-pointer" : ""}`}
      style={{ background: "var(--gradient-sky)" }}
    >
      <AmbientBlobs />
      <BackgroundSparkles />

      {stage === "partner-name" && (
        <AnimatePresence>
          {!hasInteracted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 3, duration: 0.8 }}
              className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-6 text-center"
            >
              <span className="text-[14px] font-semibold text-sn-ink animate-pulse">
                Tap anywhere to listen, volumes up or earphones on, baby!
              </span>
            </motion.div>
          )}
          {hasInteracted && !isVmPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-6 text-center"
            >
              <span className="text-[14px] font-semibold text-sn-ink animate-pulse">
                Tap anywhere to continue
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Back Button for multi-stage partner onboarding sheets */}
      {["partner-name-input", "partner-pin", "partner-confirm"].includes(stage) && (
        <button
          onClick={handleBack}
          aria-label="Back"
          className="sn-pill sn-icon-btn absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 h-11 w-11 sm:left-6 sm:top-6"
        >
          <ArrowLeft size={19} strokeWidth={2} />
        </button>
      )}

      {/* Render Lily Confettis Canvas Overlay */}
      {stage === "partner-name" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-30"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <Screen key="loading">
            <motion.img
              src={ART.clayHeart}
              alt=""
              aria-hidden
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="h-16 w-16 select-none"
            />
            <div className="mt-4 text-[15px] text-sn-muted">Warming your space…</div>
          </Screen>
        )}

        {stage === "error" && (
          <Screen key="error">
            <Title
              title="Waking your space"
              sub="Reconnecting automatically…"
            />
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={() => initApp()}
                className="sn-pill h-12 px-8 text-[15px]"
              >
                Retry now
              </button>
              <button
                onClick={() => window.location.reload()}
                className="sn-ghost h-10 px-5 text-[14px]"
              >
                Reload page
              </button>
            </div>
          </Screen>
        )}

        {stage === "setup-name" && (
          <Screen key="name">
            <Title
              wordmark
              title="What should we call you?"
            />
            <NameInput value={name} onChange={setName} />
            <ContinueButton disabled={!name.trim()} onClick={() => setStage("setup-pin")} />
          </Screen>
        )}
        {stage === "setup-pin" && (
          <Screen key="setpin">
            <Title
              kicker={`Hi, ${name.trim()}`}
              title="Choose your PIN"
            />
            <div className="mt-9">
              <PinKeypad
                value={pin}
                onChange={setPin}
                onComplete={(v) => {
                  setPinConfirm("");
                  setPin(v);
                  setStage("setup-confirm");
                }}
              />
            </div>
          </Screen>
        )}
        {stage === "setup-confirm" && (
          <Screen key="confirm">
            <Title
              kicker="Once more"
              title="Confirm your PIN"
            />
            <div className="mt-9">
              <PinKeypad
                value={pinConfirm}
                onChange={setPinConfirm}
                onComplete={(v) => {
                  if (v === pin) completeSetup(v);
                  else {
                    setPinConfirm("");
                    toast.error("Doesn't match. Try again.");
                  }
                }}
              />
            </div>
          </Screen>
        )}

        {/* Page 1: Custom Monthsary Celebration, Floating Sparkling Lily bouquet, VM Instructions & Audio Player */}
        {stage === "partner-name" && (
          <Screen key="pname">
            <motion.h1
              variants={sentenceVariants}
              initial="hidden"
              animate="visible"
              className="mt-4 flex flex-wrap justify-center font-serif text-[36px] font-semibold leading-tight text-sn-navy sm:text-[44px]"
            >
              {"Happy 3rd Monthsary, Aya!".split(" ").map((word, wordIdx) => (
                <span key={wordIdx} className="inline-block whitespace-nowrap mr-2">
                  {Array.from(word).map((char, charIdx) => (
                    <motion.span key={charIdx} variants={letterVariants} className="inline-block">
                      {char}
                    </motion.span>
                  ))}
                </span>
              ))}
            </motion.h1>

            {/* Center Lily: Large floating bouquet with glowing backdrop and 8 twinkling stars directly touching the flower */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 95 }}
              className="my-9 relative flex justify-center items-center"
            >
              {/* Pulsing glow behind bouquet */}
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,rgba(143,170,240,0.3)_65%,transparent_100%)] blur-md"
              />

              {/* Floating Couple Sticker wrapper */}
              <motion.img
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                src="/couple-sticker.webp"
                alt="Sean & Aya Sticker"
                className="relative h-60 w-60 object-contain drop-shadow-[0_14px_28px_rgba(80,100,170,0.25)] sm:h-72 sm:w-72"
              />

              {/* Twinkling star 1 */}
              <motion.svg
                animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ duration: 2.1, repeat: Infinity, repeatDelay: 0.5 }}
                style={{ top: "15%", left: "20%" }}
                className="absolute w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 2 */}
              <motion.svg
                animate={{ scale: [0, 1.1, 0], opacity: [0, 1, 0], rotate: [0, -90] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.7, delay: 0.6 }}
                style={{ bottom: "18%", right: "22%" }}
                className="absolute w-3.5 h-3.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 3 */}
              <motion.svg
                animate={{ scale: [0, 1.0, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ duration: 1.9, repeat: Infinity, repeatDelay: 1.1, delay: 1.2 }}
                style={{ top: "35%", right: "25%" }}
                className="absolute w-3 h-3 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 4 */}
              <motion.svg
                animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, -90] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.6, delay: 0.3 }}
                style={{ bottom: "38%", left: "25%" }}
                className="absolute w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 5 */}
              <motion.svg
                animate={{ scale: [0, 1.0, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ duration: 2.0, repeat: Infinity, repeatDelay: 0.8, delay: 0.9 }}
                style={{ top: "22%", right: "15%" }}
                className="absolute w-3 h-3 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 6 */}
              <motion.svg
                animate={{ scale: [0, 1.1, 0], opacity: [0, 1, 0], rotate: [0, -90] }}
                transition={{ duration: 2.3, repeat: Infinity, repeatDelay: 1.2, delay: 1.5 }}
                style={{ top: "50%", left: "18%" }}
                className="absolute w-3.5 h-3.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 7 */}
              <motion.svg
                animate={{ scale: [0, 1.0, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ duration: 1.7, repeat: Infinity, repeatDelay: 0.9, delay: 0.5 }}
                style={{ bottom: "10%", left: "45%" }}
                className="absolute w-3 h-3 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>

              {/* Twinkling star 8 */}
              <motion.svg
                animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0], rotate: [0, -90] }}
                transition={{ duration: 2.0, repeat: Infinity, repeatDelay: 0.4, delay: 1.0 }}
                style={{ top: "10%", left: "50%" }}
                className="absolute w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,1)] drop-shadow-[0_0_16px_rgba(255,255,255,0.9)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
              </motion.svg>
            </motion.div>

            {/* EQ Visualizer — shows while VM is playing, driven by real audio frequency data */}
            <AnimatePresence>
              {hasInteracted && isVmPlaying && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <EqVisualizer analyser={analyserNode} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Replay & Download Controls — only shown after VM finishes */}
            <AnimatePresence>
              {hasInteracted && !isVmPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-4 mt-2 z-20"
                >
                  <button
                    onClick={handleReplayVm}
                    className="sn-pill h-11 px-5 text-[14px]"
                  >
                    <Play size={15} fill="currentColor" />
                    Listen Again
                  </button>
                  <button
                    onClick={handleDownloadVm}
                    className="sn-pill h-11 px-5 text-[14px]"
                  >
                    <Download size={16} strokeWidth={1.9} />
                    Download VM
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </Screen>
        )}

        {/* Page 2: Name input onboarding with Monthsary congrats and cycling compliments */}
        {stage === "partner-name-input" && (
          <Screen key="pname-input">
            <div className="sn-hand flex min-h-[30px] flex-wrap items-center justify-center gap-x-1.5 text-[22px] text-sn-ink">
              <span>You must be the</span>
              <span className="inline-flex min-w-[80px] justify-center text-[#c9457a]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={wordIndex}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    {COMPLIMENT_WORDS[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span>girlfriend?</span>
            </div>

            <h1 className="mt-3 font-serif text-[34px] font-semibold leading-tight text-sn-navy sm:text-[40px]">
              Congratulations on your monthsary
            </h1>

            <NameInput value={name} onChange={setName} />
            <ContinueButton
              disabled={!name.trim()}
              onClick={() => {
                pinStorage.setName(name.trim());
                setStage("partner-pin");
              }}
            />
          </Screen>
        )}

        {stage === "partner-pin" && (
          <Screen key="ppin">
            <Title
              kicker={name ? `Hi, ${name}` : undefined}
              title="Choose your own PIN"
            />
            <div className="mt-9">
              <PinKeypad
                value={pin}
                onChange={setPin}
                onComplete={(v) => {
                  setPinConfirm("");
                  setPin(v);
                  setStage("partner-confirm");
                }}
              />
            </div>
          </Screen>
        )}
        {stage === "partner-confirm" && (
          <Screen key="pconfirm">
            <Title
              kicker="Once more"
              title="Confirm your PIN"
            />
            <div className="mt-9">
              <PinKeypad
                value={pinConfirm}
                onChange={setPinConfirm}
                onComplete={(v) => {
                  if (v === pin) completePartnerSetup(v);
                  else {
                    setPinConfirm("");
                    toast.error("Doesn't match.");
                  }
                }}
              />
            </div>
          </Screen>
        )}

        {stage === "unlock" && (
          <Screen key="unlock">
            <CouplePortraits />
            <Title wordmark title="Enter your PIN" />
            <div className="mt-9">
              <PinKeypad value={pin} onChange={setPin} onComplete={tryUnlock} />
            </div>
            <p className="sn-hand mt-7 text-center text-[19px] leading-snug text-[#646d93]">
              forgot it? your partner can set a new one in Settings
            </p>
          </Screen>
        )}

      </AnimatePresence>
    </div>
  );
}

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your name"
      maxLength={40}
      aria-label="Your name"
      className="mt-8 h-14 w-full max-w-[300px] rounded-full border border-white/90 bg-white/80 px-6 text-center text-[18px] text-sn-navy shadow-[var(--shadow-pill)] outline-none backdrop-blur-xl placeholder:text-sn-faint focus:border-sn-periwinkle"
    />
  );
}
function ContinueButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick} className="sn-pill mt-5 h-12 px-9 text-[15.5px]">
      Continue
    </button>
  );
}
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      className="relative z-10 flex max-h-full w-full max-w-md flex-col items-center overflow-y-auto px-6 py-8 text-center"
    >
      {children}
    </motion.div>
  );
}
function Title({
  kicker,
  title,
  sub,
  wordmark,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  wordmark?: boolean;
}) {
  return (
    <>
      {wordmark ? (
        <div className="font-serif text-[20px] font-medium tracking-[0.18em] text-[#38457c]">
          SEANAYA
        </div>
      ) : kicker ? (
        <div className="sn-hand text-[22px] text-sn-ink">{kicker}</div>
      ) : null}
      <h1 className="mt-2 font-serif text-[32px] font-semibold leading-tight text-sn-navy sm:text-[38px]">
        {title}
      </h1>
      {sub && <p className="mt-2 text-[15px] text-sn-muted">{sub}</p>}
    </>
  );
}
/** Both of you, side by side, on the lock screen. */
function CouplePortraits() {
  const { me, partner, slot } = useCoupleNames();
  const [a, b] = slot === "a" ? [me, partner] : [partner, me];
  return (
    <div className="mb-6 flex items-end justify-center">
      <img
        src={ART.seanChibi}
        alt={a}
        className="h-[84px] w-[74px] -rotate-6 rounded-[20px] border-[3px] border-white object-cover shadow-[0_10px_22px_-12px_rgba(86,104,176,0.6)]"
      />
      <img src={ART.clayHeart} alt="" aria-hidden className="z-10 -mx-3 mb-1 h-9 w-9 select-none" />
      <img
        src={ART.ayaChibi}
        alt={b}
        className="h-[84px] w-[74px] rotate-6 rounded-[20px] border-[3px] border-white object-cover shadow-[0_10px_22px_-12px_rgba(86,104,176,0.6)]"
      />
    </div>
  );
}
/** Soft sky scenery behind every lock and onboarding screen. */
function AmbientBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <img src="/art/cloud-puff.webp" alt="" className="sn-cloud -left-28 top-[12%] w-[380px] opacity-60" />
      <img src="/art/cloud-puff.webp" alt="" className="sn-cloud -right-32 top-[58%] w-[340px] opacity-50" />
      <img
        src={ART.lilyOpen}
        alt=""
        className="absolute -right-10 -top-12 w-[190px] -rotate-[18deg] opacity-95 sm:w-[230px]"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[110px]"
        style={{
          backgroundImage: `url(${ART.cloudBand})`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "left bottom",
        }}
      />
    </div>
  );
}
