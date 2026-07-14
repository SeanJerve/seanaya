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
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { toast.error("Could not open your space"); return; }
      }
      const s = await refreshSpace();
      if (!s)                       setStage("setup-name");
      else if (s.has_a && s.has_b)  setStage("unlock");
      else if (s.has_a && !s.has_b) setStage(pinStorage.getName() ? "partner-pin" : "partner-name");
      else                          setStage("setup-name"); // shouldn't happen but safe
    })();
     
  }, []);

  // -------- Setup slot A (creator) --------
  async function completeSetup(finalPin: string) {
    const hash = await hashPin(finalPin);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
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
    await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() });
    setStage("unlocked");
  }

  // -------- Setup slot B (partner) --------
  async function completePartnerSetup(finalPin: string) {
    const hash = await hashPin(finalPin);
    if (!space) return;
    const { error } = await supabase.rpc("set_partner_pin", {
      _rel_id: space.id, _pin_hash: hash, _name: name.trim() || null,
    });
    if (error) {
      toast.error(error.message.includes("different pin") ? "Pick a different PIN than your partner" : "Couldn't join the space");
      setPin(""); setPinConfirm(""); setStage("partner-pin"); return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("profiles").upsert({ id: u.user.id, display_name: name.trim() || "partner" });
    pinStorage.setName(name.trim() || "you");
    pinStorage.setSlot("b");
    setStage("unlocked");
  }

  // -------- Returning: enter PIN → resolve slot --------
  async function tryUnlock(input: string) {
    if (!space) return;
    const hash = await hashPin(input);
    const { data, error } = await supabase.rpc("claim_slot", { _rel_id: space.id, _pin_hash: hash });
    if (error || !data) { setPin(""); toast.error("PIN doesn't match"); return; }
    const slot = data as Slot;
    pinStorage.setSlot(slot);
    const label = slot === "a" ? (space.name_a || "you") : (space.name_b || "you");
    pinStorage.setName(label);
    setStage("unlocked");
  }

  // -------- Forgot: anniversary → reset one slot --------
  async function completeReset(newPin: string) {
    if (!space) return;
    const h = await hashPin(newPin);
    const { error } = await supabase.rpc("reset_slot_pin", {
      _rel_id: space.id, _slot: resetSlot, _new_hash: h,
      _anniversary: (space as unknown as { anniversary?: string }).anniversary ?? null,
    });
    // reset_slot_pin needs anniversary; fetch from relationships if RPC returned error about it
    if (error) {
      const { data: rel } = await supabase.from("relationships").select("anniversary").eq("id", space.id).maybeSingle();
      const { error: e2 } = await supabase.rpc("reset_slot_pin", {
        _rel_id: space.id, _slot: resetSlot, _new_hash: h, _anniversary: rel?.anniversary ?? "2026-06-19",
      });
      if (e2) { toast.error("Couldn't reset. Try again."); return; }
    }
    toast.success("PIN updated. Enter it now.");
    setPin(""); setStage("unlock");
    refreshSpace();
  }

  if (stage === "unlocked") return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
      <AmbientBlobs />
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

        {stage === "partner-name" && (
          <Screen key="pname">
            <Title
              kicker="A space is already open"
              title={space?.name_a ? `You must be ${space.name_a}'s person` : "You must be the other half"}
              sub="What should we call you here?"
            />
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
              <PinKeypad value={pin} onChange={setPin} onComplete={tryUnlock}
                bottomAction={
                  <button
                    onClick={() => { setPin(""); setDateInput(""); setStage("forgot-who"); }}
                    className="h-[70px] w-[70px] rounded-full text-[11px] uppercase tracking-wider text-foreground/60 hover:text-foreground transition"
                  >Forgot</button>
                } />
            </div>
          </Screen>
        )}

        {stage === "forgot-who" && (
          <Screen key="forgot-who">
            <Title kicker="Reset PIN" title="Whose PIN?" sub="Choose the one to reset." />
            <div className="mt-8 flex gap-3">
              <SlotChoice label={space?.name_a || "Partner A"} onClick={() => { setResetSlot("a"); setStage("forgot-date"); }} />
              <SlotChoice label={space?.name_b || "Partner B"} onClick={() => { setResetSlot("b"); setStage("forgot-date"); }} />
            </div>
            <button onClick={() => setStage("unlock")} className="mt-6 text-xs text-muted-foreground underline">Never mind</button>
          </Screen>
        )}
        {stage === "forgot-date" && (
          <Screen key="forgot">
            <Title kicker="Reset PIN" title="A gentle question" sub="What date did we become official?" />
            <input autoFocus value={dateInput} onChange={(e) => setDateInput(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="mt-8 w-80 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-6 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40" />
            <div className="mt-6 flex gap-3">
              <button onClick={() => setStage("unlock")} className="rounded-full border border-foreground/20 px-6 py-2 text-sm">Cancel</button>
              <button
                onClick={async () => {
                  const { data: rel } = await supabase.from("relationships").select("anniversary").eq("id", space?.id ?? "").maybeSingle();
                  const iso = rel?.anniversary ?? "2026-06-19";
                  if (isAnniversaryMatch(dateInput, iso)) { setPin(""); setStage("forgot-newpin"); }
                  else toast.error("That's not the day.");
                }}
                className="rounded-full bg-foreground/90 px-8 py-2 text-sm text-background">Continue</button>
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
function SlotChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl border border-white/50 bg-white/50 px-6 py-4 text-sm backdrop-blur-xl hover:bg-white/70">
      {label}
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
