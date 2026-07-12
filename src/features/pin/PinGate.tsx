import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hashPin, isAnniversaryMatch, pinStorage } from "./pin-utils";
import { PinKeypad } from "./PinKeypad";

type Stage =
  | "loading"
  | "choose"          // new device: create or join
  | "setup-name"
  | "setup-pin"
  | "setup-confirm"
  | "join-code"       // enter partner's invite code
  | "join-pin"        // enter shared PIN
  | "unlock"
  | "forgot-date"
  | "forgot-newpin"
  | "unlocked";

/**
 * The gate now uses a SHARED PIN stored on the relationship row.
 * Two devices linked by the same invite code unlock with the same 4-digit PIN.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinRelId, setJoinRelId] = useState<string | null>(null);
  const [joinRelPinHash, setJoinRelPinHash] = useState<string | null>(null);

  // Bootstrap: silent anonymous sign-in + resolve current relationship
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { toast.error("Could not open your space"); return; }
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      // Is this user already part of a relationship?
      const { data: rel } = await supabase
        .from("relationships")
        .select("id,pin_hash,name,user_a_id,user_b_id")
        .or(`user_a_id.eq.${u.user.id},user_b_id.eq.${u.user.id}`)
        .maybeSingle();

      const storedName = pinStorage.getName();
      if (storedName) setName(storedName);

      if (rel?.pin_hash) {
        pinStorage.set(rel.pin_hash);
        if (!storedName && rel.name) setName(rel.name);
        setStage("unlock");
        return;
      }
      // No relationship yet on this device — offer choice.
      setStage("choose");
    })();
  }, []);

  async function completeSetup(finalPin: string) {
    const hash = await hashPin(finalPin);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // Create relationship with shared PIN
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: rel, error } = await supabase
      .from("relationships")
      .insert({ user_a_id: u.user.id, invite_code: code, name: name.trim() || "Seanaya", pin_hash: hash })
      .select("*").single();
    if (error) { toast.error("Could not create your space"); return; }

    pinStorage.set(hash);
    pinStorage.setName(name.trim());
    if (rel.invite_code) pinStorage.setInvite(rel.invite_code);
    await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() });
    setStage("unlocked");
  }

  async function tryUnlock(input: string) {
    const hash = await hashPin(input);
    if (hash === pinStorage.get()) { setStage("unlocked"); return; }
    setPin(""); toast.error("PIN doesn't match");
  }

  async function findByInvite() {
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) { toast.error("Invite code is 6 characters"); return; }
    const { data: rel } = await supabase
      .from("relationships")
      .select("id,pin_hash,name,user_a_id,user_b_id")
      .eq("invite_code", code).maybeSingle();
    if (!rel) { toast.error("No space with that code"); return; }
    if (!rel.pin_hash) { toast.error("Partner hasn't set a PIN yet"); return; }
    setJoinRelId(rel.id);
    setJoinRelPinHash(rel.pin_hash);
    setPin(""); setStage("join-pin");
  }

  async function verifyJoinPin(input: string) {
    const hash = await hashPin(input);
    if (hash !== joinRelPinHash) { setPin(""); toast.error("PIN doesn't match"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !joinRelId) return;
    // Link as user_b_id if free; if user_a claimed by another device, still allow read access as user_b
    const { data: rel } = await supabase.from("relationships").select("*").eq("id", joinRelId).single();
    if (rel && !rel.user_b_id && rel.user_a_id !== u.user.id) {
      await supabase.from("relationships").update({ user_b_id: u.user.id }).eq("id", joinRelId);
    }
    pinStorage.set(hash);
    pinStorage.setName(name.trim() || rel?.name || "you");
    pinStorage.setInvite(joinCode.toUpperCase());
    await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() || "partner" });
    setStage("unlocked");
  }

  if (stage === "unlocked") return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
      <AmbientBlobs />
      <AnimatePresence mode="wait">
        {stage === "loading" && (
          <Screen key="loading"><div className="text-sm text-muted-foreground">Warming your space…</div></Screen>
        )}

        {stage === "choose" && (
          <Screen key="choose">
            <Title kicker="Welcome to" title="Seanaya" sub="Set up a new space, or join one your partner already made." />
            <div className="mt-8 flex flex-col gap-3 w-72">
              <button
                onClick={() => setStage("setup-name")}
                className="rounded-full bg-foreground/90 px-8 py-3 text-sm text-background"
              >Create a new space</button>
              <button
                onClick={() => setStage("join-code")}
                className="rounded-full border border-foreground/25 bg-white/40 backdrop-blur-xl px-8 py-3 text-sm"
              >I have an invite code</button>
            </div>
          </Screen>
        )}

        {stage === "setup-name" && (
          <Screen key="name">
            <Title kicker="Welcome to" title="Seanaya" sub="What should we call you?" />
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your name" maxLength={40}
              className="mt-8 w-72 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button disabled={!name.trim()} onClick={() => setStage("setup-pin")}
              className="mt-6 rounded-full bg-foreground/90 px-8 py-2.5 text-sm text-background disabled:opacity-40">
              Continue
            </button>
          </Screen>
        )}

        {stage === "setup-pin" && (
          <Screen key="setpin">
            <Title kicker={`Hi, ${name.trim()}`} title="Create a PIN" sub="Four digits. Both of you will use this to enter Seanaya." />
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

        {stage === "join-code" && (
          <Screen key="joincode">
            <Title kicker="Join a space" title="Invite code" sub="Ask your partner for the 6-character code from their Settings." />
            <input autoFocus value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF" maxLength={6}
              className="mt-8 w-64 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-2xl tracking-[0.5em] font-mono outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
              className="mt-3 w-64 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-2.5 text-center text-sm outline-none"
            />
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStage("choose")}
                className="rounded-full border border-foreground/20 px-6 py-2 text-sm">Back</button>
              <button onClick={findByInvite}
                className="rounded-full bg-foreground/90 px-8 py-2 text-sm text-background">Continue</button>
            </div>
          </Screen>
        )}

        {stage === "join-pin" && (
          <Screen key="joinpin">
            <Title kicker="Almost in" title="Shared PIN" sub="Enter the PIN your partner set." />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin} onComplete={verifyJoinPin} />
            </div>
          </Screen>
        )}

        {stage === "unlock" && (
          <Screen key="unlock">
            <Title kicker="Welcome back" title={name || "hello"} sub="Enter your PIN" />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin} onComplete={tryUnlock}
                bottomAction={
                  <button
                    onClick={() => { setPin(""); setDateInput(""); setStage("forgot-date"); }}
                    className="h-[70px] w-[70px] rounded-full text-[11px] uppercase tracking-wider text-foreground/60 hover:text-foreground transition"
                  >Forgot</button>
                } />
            </div>
          </Screen>
        )}

        {stage === "forgot-date" && (
          <Screen key="forgot">
            <Title kicker="Reset PIN" title="A gentle question" sub="What date did we become official?" />
            <input autoFocus value={dateInput} onChange={(e) => setDateInput(e.target.value)}
              placeholder="Month Day Year"
              className="mt-8 w-80 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStage("unlock")} className="rounded-full border border-foreground/20 px-6 py-2 text-sm">Cancel</button>
              <button
                onClick={() => { if (isAnniversaryMatch(dateInput)) { setPin(""); setStage("forgot-newpin"); } else toast.error("That's not the day."); }}
                className="rounded-full bg-foreground/90 px-8 py-2 text-sm text-background">Continue</button>
            </div>
          </Screen>
        )}

        {stage === "forgot-newpin" && (
          <Screen key="newpin">
            <Title kicker="Reset PIN" title="Pick a new PIN" sub="Four digits — both devices will use it." />
            <div className="mt-10">
              <PinKeypad value={pin} onChange={setPin}
                onComplete={async (v) => {
                  const h = await hashPin(v);
                  const { data: u } = await supabase.auth.getUser();
                  if (u.user) {
                    const { data: rel } = await supabase.from("relationships").select("id")
                      .or(`user_a_id.eq.${u.user.id},user_b_id.eq.${u.user.id}`).maybeSingle();
                    if (rel) await supabase.from("relationships").update({ pin_hash: h }).eq("id", rel.id);
                  }
                  pinStorage.set(h);
                  setStage("unlocked");
                }} />
            </div>
          </Screen>
        )}
      </AnimatePresence>
    </div>
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
