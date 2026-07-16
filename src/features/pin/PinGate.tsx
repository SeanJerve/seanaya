import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Play, Download, Volume2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isAnniversaryMatch, pinStorage, type Slot } from "./pin-utils";
import { PinKeypad } from "./PinKeypad";

type Stage =
  | "loading"
  | "setup-name"        // no space yet — first user (creator)
  | "setup-pin"
  | "setup-confirm"
  | "partner-name"      // Page 1: Greeting + Voice Message
  | "partner-name-input"// Page 2: Name Onboarding
  | "partner-pin"
  | "partner-confirm"
  | "unlock"            // both PINs exist → PIN pad
  | "forgot-who"
  | "forgot-date"
  | "forgot-newpin"
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
  "magnificent"
];

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
          animate={{ opacity: [0.12, 0.45, 0.12], scale: [s.scale * 0.8, s.scale * 1.2, s.scale * 0.8] }}
          transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
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
  const [space, setSpace] = useState<SpaceState | null>(null);
  const [name, setName] = useState(pinStorage.getName() ?? "");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [resetSlot, setResetSlot] = useState<Slot>("a");

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

  const refreshSpace = async (): Promise<SpaceState | null> => {
    const { data } = await supabase.rpc("get_space_state");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const s: SpaceState = row as SpaceState;
    setSpace(s);
    pinStorage.setRel(s.id);
    return s;
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error("Sign in anonymously failed:", error);
            toast.error(`Could not open your space: ${error.message}`);
            return;
          }
        }
        const s = await refreshSpace();
        const urlInvite = new URLSearchParams(window.location.search).get("invite");
        const urlReset = new URLSearchParams(window.location.search).get("reset");
        const urlDate = new URLSearchParams(window.location.search).get("date");
        
        if (!s) {
          setStage("setup-name");
        } else if (urlReset && urlDate && (urlReset === "a" || urlReset === "b")) {
          setResetSlot(urlReset as Slot);
          setDateInput(urlDate);
          setStage("forgot-newpin");
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
        toast.error(`Connection error: ${err.message || String(err)}`);
      }
    })();
  }, []);

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

    const lilyImages = ["/lily1.png", "/lily2.png", "/lily3.png", "/lily4.png"];
    const loadedImages = lilyImages.map((src) => {
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

  // Audio Activation & Tap Screen Continue Trigger
  const handleScreenTap = () => {
    if (stage !== "partner-name") return;
    
    if (!hasInteracted) {
      setHasInteracted(true);
      try {
        // Play Romantic Background Entrance Music
        const bg = new Audio("https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-12.mp3");
        bg.loop = true;
        bg.volume = 0.22;
        bgMusicRef.current = bg;
        bg.play().catch((err) => console.log("BG Music Autoplay blocked:", err));

        // Play Voice Message
        const vm = new Audio("/voice-message.mp3");
        vm.volume = 1.0;
        voiceMessageRef.current = vm;
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
      // If already interacted, tapping anywhere else continues to Page 2!
      setStage("partner-name-input");
    }
  };

  const handleReplayVm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voiceMessageRef.current) {
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
        .select("id").single();
      
      if (error) { toast.error("Could not create your space"); return; }
      pinStorage.setName(name.trim());
      pinStorage.setRel(rel.id);
      pinStorage.setSlot("a");
      pinStorage.setInvite(code);
      await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() });
      
      const inviteLink = `${window.location.origin}/?invite=${code}`;
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteLink).catch(() => {});
      }
      toast.success("Space created! Invite link copied to clipboard.", { duration: 6000 });
      
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
      });
      if (error) {
        toast.error(error.message.includes("different pin") ? "Pick a different PIN than your partner" : "Could not join space");
        return;
      }
      
      pinStorage.setSlot("b");
      const { data: u } = await supabase.auth.getUser();
      if (u.user) await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() || "partner" });
      
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
      const { data, error } = await supabase.rpc("claim_slot", { _rel_id: space.id, _pin_hash: hash });
      if (error || !data) { setPin(""); toast.error("PIN doesn't match"); return; }
      const slot = data as Slot;
      pinStorage.setSlot(slot);
      const label = slot === "a" ? (space.name_a || "you") : (space.name_b || "you");
      pinStorage.setName(label);
      setStage("unlocked");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong");
    }
  }

  // -------- Forgot: anniversary → reset one slot --------
  async function completeReset(newPin: string) {
    if (!space) return;
    const h = await hashPin(newPin);
    const { error } = await supabase.rpc("reset_slot_pin", {
      _rel_id: space.id, _slot: resetSlot, _new_hash: h, _anniversary: dateInput,
    });
    if (error) { toast.error("Reset link is invalid or expired."); return; }
    toast.success("PIN updated. You can now log in.");
    setPin(""); 
    
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    setStage("unlock");
    refreshSpace();
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 0.8 }}
          className="absolute bottom-8 left-0 right-0 flex justify-center text-center px-6 pointer-events-none z-20"
        >
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80 animate-pulse">
            {!hasInteracted
              ? "Tap anywhere to listen, volumes up or earphones on, baby!"
              : "Tap anywhere to continue"}
          </span>
        </motion.div>
      )}

      {/* Back Button for multi-stage partner onboarding sheets */}
      {["partner-name-input", "partner-pin", "partner-confirm"].includes(stage) && (
        <button
          onClick={handleBack}
          className="absolute top-5 left-5 z-20 p-2.5 rounded-full border border-white/40 bg-white/20 backdrop-blur-xl hover:bg-white/40 active:scale-95 transition text-foreground"
        >
          <ArrowLeft size={16} />
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
          <Screen key="loading"><div className="text-sm text-muted-foreground">Warming your space...</div></Screen>
        )}

        {stage === "setup-name" && (
          <Screen key="name">
            <Title kicker="Welcome to" title="Seanaya" sub="This is your space. What should we call you?" />
            <NameInput value={name} onChange={setName} />
            <ContinueButton disabled={!name.trim()} onClick={() => setStage("setup-pin")} />
          </Screen>
        )}
        {stage === "setup-pin" && (
          <Screen key="setpin">
            <Title kicker={`Hi, ${name.trim()}`} title="Set your PIN" sub="Four digits. This is just yours." />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin}
                onComplete={(v) => { setPinConfirm(""); setPin(v); setStage("setup-confirm"); }} />
            </div>
          </Screen>
        )}
        {stage === "setup-confirm" && (
          <Screen key="confirm">
            <Title kicker="Almost there" title="Confirm your PIN" sub="Enter the same four digits again." />
            <div className="mt-10">
              <PinKeypad value={pinConfirm} onChange={setPinConfirm}
                onComplete={(v) => { if (v === pin) completeSetup(v); else { setPinConfirm(""); toast.error("Doesn't match. Try again."); } }} />
            </div>
          </Screen>
        )}

        {/* Page 1: Custom Monthsary Celebration, Floating Sparkling Lily bouquet, VM Instructions & Audio Player */}
        {stage === "partner-name" && (
          <Screen key="pname">
            <h1 className="display text-4xl leading-tight text-foreground mt-4">
              Happy 1st Monthsary, Aya!
            </h1>
            
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
                className="absolute w-52 h-52 bg-[radial-gradient(circle,rgba(255,255,255,0.75)_0%,rgba(14,165,233,0.25)_65%,transparent_100%)] blur-md rounded-full"
              />
              
              {/* Floating Bouquet wrapper */}
              <motion.img
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                src="/main-lily.png"
                alt="White Lily Bouquet"
                className="relative w-64 h-64 object-contain"
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

            {/* Audio Feedback status waves */}
            {hasInteracted && isVmPlaying && (
              <div className="flex items-center gap-1 my-3 text-primary animate-pulse">
                <Volume2 size={15} />
                <span className="text-[10px] uppercase tracking-widest font-mono">Playing VM</span>
              </div>
            )}

            {/* Replay & Download Controls */}
            {hasInteracted && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4 mt-2 z-20"
              >
                <button
                  onClick={handleReplayVm}
                  className="flex items-center gap-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-5 py-2 text-[11px] font-medium hover:bg-white/60 transition shadow-sm"
                >
                  <Play size={10} fill="currentColor" />
                  Listen Again
                </button>
                <button
                  onClick={handleDownloadVm}
                  className="flex items-center gap-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-5 py-2 text-[11px] font-medium hover:bg-white/60 transition shadow-sm"
                >
                  <Download size={10} />
                  Download Msg
                </button>
              </motion.div>
            )}

          </Screen>
        )}

        {/* Page 2: Name input onboarding with Monthsary congrats and cycling compliments */}
        {stage === "partner-name-input" && (
          <Screen key="pname-input">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center justify-center flex-wrap gap-x-1 min-h-[16px]">
              <span>You must be the</span>
              <span className="font-semibold text-primary inline-flex min-w-[70px] justify-center">
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

            <h1 className="display mt-3 text-4xl leading-tight text-foreground">
              Congratulations on your monthsary!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              What should we call you here?
            </p>

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
            <Title kicker={name ? `Hi, ${name}` : "Hi"} title="Set your own PIN" sub="Four digits — just yours. Different from your partner's." />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin}
                onComplete={(v) => { setPinConfirm(""); setPin(v); setStage("partner-confirm"); }} />
            </div>
          </Screen>
        )}
        {stage === "partner-confirm" && (
          <Screen key="pconfirm">
            <Title kicker="Almost there" title="Confirm your PIN" sub="Enter the same four digits again." />
            <div className="mt-10">
              <PinKeypad value={pinConfirm} onChange={setPinConfirm}
                onComplete={(v) => { if (v === pin) completePartnerSetup(v); else { setPinConfirm(""); toast.error("Doesn't match."); } }} />
            </div>
          </Screen>
        )}

        {stage === "unlock" && (
          <Screen key="unlock">
            <Title kicker="Seanaya" title="Enter your PIN" sub={space?.name_a && space?.name_b ? `${space.name_a} · ${space.name_b}` : "Either PIN opens your space"} />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin} onComplete={tryUnlock} />
            </div>
          </Screen>
        )}

        {stage === "forgot-newpin" && (
          <Screen key="newpin">
            <Title kicker="Reset PIN" title="Pick a new PIN" sub="Four digits." />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin} onComplete={completeReset} />
            </div>
          </Screen>
        )}
      </AnimatePresence>
    </div>
  );
}

function NameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      autoFocus value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Your name" maxLength={40}
      className="mt-8 w-72 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}
function ContinueButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="mt-6 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-8 py-2.5 text-sm text-foreground hover:bg-white/60 active:scale-95 transition shadow-sm disabled:opacity-40 disabled:hover:bg-white/40 font-medium">
      Continue
    </button>
  );
}
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center">
      {children}
    </motion.div>
  );
}
function Title({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{kicker}</div>
      <div className="display mt-2 text-4xl leading-tight">{title}</div>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </>
  );
}
function AmbientBlobs() {
  return (
    <>
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
    </>
  );
}
