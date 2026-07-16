import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isAnniversaryMatch, pinStorage, type Slot } from "./pin-utils";
import { PinKeypad } from "./PinKeypad";

type Stage =
  | "loading"
  | "setup-name"        // no space yet — first user (creator)
  | "setup-pin"
  | "setup-confirm"
  | "partner-name"      // space exists, partner slot empty
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

type LilyParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
  img: string;
};

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

  // Particles for the lily confetti explosion
  const [particles, setParticles] = useState<LilyParticle[]>([]);

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

  // Effect to trigger white lily confetti poppers upon partner-name landing
  useEffect(() => {
    if (stage !== "partner-name") {
      setParticles([]);
      return;
    }

    const list: LilyParticle[] = [];
    const lilyImages = ["/lily1.png", "/lily2.png", "/lily3.png", "/lily4.png"];

    // Left Popper (20 particles)
    for (let i = 0; i < 20; i++) {
      list.push({
        id: i,
        x: 5,
        y: 95,
        vx: 0.6 + Math.random() * 1.4,
        vy: -2.8 - Math.random() * 2.2,
        rotation: Math.random() * 360,
        rotationSpeed: -3 + Math.random() * 6,
        scale: 0.18 + Math.random() * 0.22,
        opacity: 1,
        img: lilyImages[Math.floor(Math.random() * lilyImages.length)],
      });
    }

    // Right Popper (20 particles)
    for (let i = 0; i < 20; i++) {
      list.push({
        id: i + 20,
        x: 95,
        y: 95,
        vx: -0.6 - Math.random() * 1.4,
        vy: -2.8 - Math.random() * 2.2,
        rotation: Math.random() * 360,
        rotationSpeed: -3 + Math.random() * 6,
        scale: 0.18 + Math.random() * 0.22,
        opacity: 1,
        img: lilyImages[Math.floor(Math.random() * lilyImages.length)],
      });
    }

    setParticles(list);

    let active = true;
    let lastTime = performance.now();

    const update = (time: number) => {
      if (!active) return;
      const dt = (time - lastTime) / 16.666;
      lastTime = time;

      setParticles((prev) => {
        let allDead = true;
        const next = prev.map((p) => {
          const nextX = p.x + p.vx * dt;
          const nextY = p.y + p.vy * dt;
          const nextVy = p.vy + 0.05 * dt;

          let nextOpacity = p.opacity;
          if (p.vy > 0) {
            nextOpacity = Math.max(0, p.opacity - 0.012 * dt);
          }
          if (nextOpacity > 0) {
            allDead = false;
          }

          return {
            ...p,
            x: nextX,
            y: nextY,
            vy: nextVy,
            rotation: p.rotation + p.rotationSpeed * dt,
            opacity: nextOpacity,
          };
        });

        if (allDead) {
          active = false;
        }
        return next;
      });

      if (active) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);

    return () => {
      active = false;
    };
  }, [stage]);

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

  if (stage === "unlocked") return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
      <AmbientBlobs />

      {/* Render White Lily Confettis overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {particles.map((p) => (
          <img
            key={p.id}
            src={p.img}
            alt=""
            className="absolute origin-center"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) scale(${p.scale}) rotate(${p.rotation}deg)`,
              opacity: p.opacity,
              width: "100px",
              height: "100px",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <Screen key="loading"><div className="text-sm text-muted-foreground">Warming your space…</div></Screen>
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

        {/* Custom Monthsary & White Lily Greeting Landing Page */}
        {stage === "partner-name" && (
          <Screen key="pname">
            <Title
              kicker="So you must be the girlfriend?"
              title="Happy 1st Monthsary, Aya!"
              sub="What should we call you here?"
            />
            
            {/* Bouncing glowing center white lily */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 95 }}
              className="my-7 relative flex justify-center items-center"
            >
              <div className="absolute w-24 h-24 bg-white/40 blur-xl rounded-full" />
              <img
                src="/main-lily.png"
                alt="White Lily"
                className="relative w-28 h-28 object-contain animate-bounce"
                style={{ animationDuration: "2.8s" }}
              />
            </motion.div>

            <NameInput value={name} onChange={setName} />
            <ContinueButton disabled={!name.trim()} onClick={() => { pinStorage.setName(name.trim()); setStage("partner-pin"); }} />
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
      className="mt-6 rounded-full bg-foreground/90 px-8 py-2.5 text-sm text-background disabled:opacity-40">
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
