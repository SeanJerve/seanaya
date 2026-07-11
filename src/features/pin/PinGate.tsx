import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isAnniversaryMatch, pinStorage } from "./pin-utils";
import { PinKeypad } from "./PinKeypad";

type Stage = "loading" | "setup-name" | "setup-pin" | "setup-confirm" | "unlock" | "forgot-date" | "forgot-newpin" | "unlocked";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [dateInput, setDateInput] = useState("");

  // Bootstrap: silent anonymous sign-in + look for stored PIN
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          toast.error("Could not open your space");
          return;
        }
      }
      const stored = pinStorage.get();
      const storedName = pinStorage.getName();
      if (!stored || !storedName) {
        setStage("setup-name");
      } else {
        setName(storedName);
        setStage("unlock");
      }
    })();
  }, []);

  async function completeSetup(finalPin: string) {
    const hash = await hashPin(finalPin);
    pinStorage.set(hash);
    pinStorage.setName(name.trim());
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("profiles").upsert({
        id: u.user.id,
        display_name: name.trim(),
        pin_hash: hash,
      });
    }
    setStage("unlocked");
  }

  async function tryUnlock(input: string) {
    const hash = await hashPin(input);
    if (hash === pinStorage.get()) {
      setStage("unlocked");
    } else {
      setPin("");
      toast.error("PIN doesn't match");
    }
  }

  if (stage === "unlocked") return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
      <AmbientBlobs />
      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <Screen key="loading">
            <div className="text-sm text-muted-foreground">Warming your space…</div>
          </Screen>
        )}

        {stage === "setup-name" && (
          <Screen key="name">
            <Title kicker="Welcome to" title="Seanaya" sub="What should we call you?" />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              className="mt-8 w-72 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              disabled={!name.trim()}
              onClick={() => setStage("setup-pin")}
              className="mt-6 rounded-full bg-foreground/90 px-8 py-2.5 text-sm text-background disabled:opacity-40"
            >
              Continue
            </button>
          </Screen>
        )}

        {stage === "setup-pin" && (
          <Screen key="setpin">
            <Title kicker={`Hi, ${name.trim()}`} title="Create a PIN" sub="Four digits. You'll use this to enter Seanaya." />
            <div className="mt-10">
              <PinKeypad
                value={pin}
                onChange={setPin}
                onComplete={(v) => { setPinConfirm(""); setStage("setup-confirm"); setPin(v); }}
              />
            </div>
          </Screen>
        )}

        {stage === "setup-confirm" && (
          <Screen key="confirm">
            <Title kicker="Almost there" title="Confirm your PIN" sub="Enter the same four digits again." />
            <div className="mt-10">
              <PinKeypad
                value={pinConfirm}
                onChange={setPinConfirm}
                onComplete={(v) => {
                  if (v === pin) completeSetup(v);
                  else { setPinConfirm(""); toast.error("Doesn't match. Try again."); }
                }}
              />
            </div>
          </Screen>
        )}

        {stage === "unlock" && (
          <Screen key="unlock">
            <Title kicker="Welcome back" title={name} sub="Enter your PIN" />
            <div className="mt-10">
              <PinKeypad
                value={pin}
                onChange={setPin}
                onComplete={tryUnlock}
                bottomAction={
                  <button
                    onClick={() => { setPin(""); setDateInput(""); setStage("forgot-date"); }}
                    className="h-[70px] w-[70px] rounded-full text-[11px] uppercase tracking-wider text-foreground/60 hover:text-foreground transition"
                  >
                    Forgot
                  </button>
                }
              />
            </div>
          </Screen>
        )}

        {stage === "forgot-date" && (
          <Screen key="forgot">
            <Title kicker="Reset PIN" title="A gentle question" sub="What date did we become official?" />
            <input
              autoFocus
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              placeholder="Month Day Year"
              className="mt-8 w-80 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStage("unlock")}
                className="rounded-full border border-foreground/20 px-6 py-2 text-sm text-foreground/70"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (isAnniversaryMatch(dateInput)) { setPin(""); setStage("forgot-newpin"); }
                  else toast.error("That's not the day.");
                }}
                className="rounded-full bg-foreground/90 px-8 py-2 text-sm text-background"
              >
                Continue
              </button>
            </div>
          </Screen>
        )}

        {stage === "forgot-newpin" && (
          <Screen key="newpin">
            <Title kicker="Reset PIN" title="Pick a new PIN" sub="Four digits." />
            <div className="mt-10">
              <PinKeypad
                value={pin}
                onChange={setPin}
                onComplete={(v) => completeSetup(v)}
              />
            </div>
          </Screen>
        )}
      </AnimatePresence>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative z-10 flex flex-col items-center px-6"
    >
      {children}
    </motion.div>
  );
}

function Title({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{kicker}</div>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function AmbientBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.85 0.08 240), transparent 70%)" }} />
      <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.88 0.06 300), transparent 70%)" }} />
    </div>
  );
}
