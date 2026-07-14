import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Sun, Moon, Sunset, Bell, BookHeart, Calendar, MapPin, PinIcon, Music2, Heart } from "lucide-react";
import { pinStorage, hashPin, ANNIVERSARY_ISO, type Slot } from "@/features/pin/pin-utils";
import { FieldWrap, Input, PrimaryButton } from "./form-ui";
import { useTheme, type Theme } from "@/lib/theme";
import { useNotificationPrefs, type PrefKind } from "@/hooks/useNotificationPrefs";

export function SettingsSheet({ relationshipId, inviteCode: _inviteCode }: { relationshipId: string; inviteCode: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(pinStorage.getName() ?? "");
  const [newPin, setNewPin] = useState("");
  const [anniversary, setAnniversary] = useState<string>("");
  const [theme, setTheme] = useTheme();
  const { prefs, set: setPref } = useNotificationPrefs();

  const slot: Slot = pinStorage.getSlot() ?? "a";

  const { data: rel } = useQuery({
    queryKey: ["settings-rel", relationshipId],
    queryFn: async () => (await supabase.from("relationships").select("*").eq("id", relationshipId).maybeSingle()).data,
  });

  useEffect(() => { if (rel?.anniversary) setAnniversary(rel.anniversary); }, [rel?.anniversary]);

  const saveName = useMutation({
    mutationFn: async () => {
      const n = displayName.trim();
      if (!n) throw new Error("Name is required");
      pinStorage.setName(n);
      const nameCol = slot === "a" ? { name_a: n } : { name_b: n };
      await supabase.from("relationships").update(nameCol).eq("id", relationshipId);
      if (user) await supabase.from("profiles").upsert({ id: user.id, display_name: n });
    },
    onSuccess: () => { toast.success("Name updated"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const savePin = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}$/.test(newPin)) throw new Error("Enter a 4-digit PIN");
      const h = await hashPin(newPin);
      const patch = slot === "a" ? { pin_hash_a: h } : { pin_hash_b: h };
      const { error } = await supabase.from("relationships").update(patch).eq("id", relationshipId);
      if (error) throw error;
    },
    onSuccess: () => { setNewPin(""); toast.success("Your PIN was updated"); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const saveAnn = useMutation({
    mutationFn: async () => {
      if (!anniversary) throw new Error("Pick a date");
      await supabase.from("relationships").update({ anniversary }).eq("id", relationshipId);
    },
    onSuccess: () => { toast.success("Anniversary saved"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const yourName = slot === "a" ? rel?.name_a : rel?.name_b;
  const partnerName = slot === "a" ? rel?.name_b : rel?.name_a;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SectionHead label="Signed in as" />
        <div className="rounded-2xl bg-white/50 px-4 py-3 text-sm backdrop-blur-xl">
          <div className="text-foreground">{yourName || "you"} <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">Slot {slot.toUpperCase()}</span></div>
          {partnerName && <div className="mt-0.5 text-[11px] text-muted-foreground">with {partnerName}</div>}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Theme" />
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "light", label: "Light", icon: <Sun size={14} /> },
            { key: "dusk",  label: "Dusk",  icon: <Sunset size={14} /> },
            { key: "night", label: "Night", icon: <Moon size={14} /> },
          ] as { key: Theme; label: string; icon: React.ReactNode }[]).map((t) => (
            <button key={t.key} onClick={() => setTheme(t.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-xs backdrop-blur-xl transition ${theme === t.key ? "border-primary/60 bg-white/70" : "border-white/40 bg-white/40"}`}>
              <span className="text-foreground/70">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Whispers" icon={<Bell size={11} />} />
        <p className="text-[11px] text-muted-foreground">Choose which of your partner's moments should notify you.</p>
        <div className="grid grid-cols-2 gap-2">
          <PrefRow k="memory" label="Memories"  icon={<BookHeart size={14} />} on={prefs.memory}  onToggle={(v) => setPref({ memory: v })} />
          <PrefRow k="event"  label="Events"    icon={<Calendar size={14} />}  on={prefs.event}   onToggle={(v) => setPref({ event: v })} />
          <PrefRow k="trip"   label="Places"    icon={<MapPin size={14} />}    on={prefs.trip}    onToggle={(v) => setPref({ trip: v })} />
          <PrefRow k="note"   label="Notes"     icon={<PinIcon size={14} />}   on={prefs.note}    onToggle={(v) => setPref({ note: v })} />
          <PrefRow k="song"   label="Songs"     icon={<Music2 size={14} />}    on={prefs.song}    onToggle={(v) => setPref({ song: v })} />
          <PrefRow k="hug"    label="Hugs"      icon={<Heart size={14} />}     on={prefs.hug}     onToggle={(v) => setPref({ hug: v })} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Your name" />
        <FieldWrap label="Displayed as"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></FieldWrap>
        <PrimaryButton onClick={() => saveName.mutate()}>Save name</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="Your PIN" />
        <p className="text-[11px] text-muted-foreground">This changes only your PIN. Your partner's PIN stays the same.</p>
        <FieldWrap label="New 4-digit PIN">
          <Input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" />
        </FieldWrap>
        <PrimaryButton onClick={() => savePin.mutate()}>Update PIN</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="Partner's PIN" />
        <p className="text-[11px] text-muted-foreground">If your partner forgot their PIN, you can generate a reset link for them.</p>
        <PrimaryButton onClick={() => {
          const partnerSlot = slot === "a" ? "b" : "a";
          const d = anniversary || rel?.anniversary || ANNIVERSARY_ISO;
          const link = `${window.location.origin}/?reset=${partnerSlot}&date=${d}`;
          if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).catch(() => {});
          }
          toast.success("Reset link copied! Send it to your partner.", { duration: 6000 });
        }}>Copy Reset Link</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="Anniversary" />
        <FieldWrap label="The day it became official">
          <Input type="date" value={anniversary || rel?.anniversary || ANNIVERSARY_ISO} onChange={(e) => setAnniversary(e.target.value)} />
        </FieldWrap>
        <PrimaryButton onClick={() => saveAnn.mutate()}>Save anniversary</PrimaryButton>
      </section>
    </div>
  );
}

function SectionHead({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>;
}
function PrefRow({ k: _k, label, icon, on, onToggle }: { k: PrefKind; label: string; icon: React.ReactNode; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button onClick={() => onToggle(!on)}
      className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-sm backdrop-blur-xl transition ${on ? "border-primary/60 bg-white/70" : "border-white/40 bg-white/40 text-foreground/60"}`}>
      <span className="flex items-center gap-2"><span className="text-foreground/70">{icon}</span>{label}</span>
      <span className={`h-4 w-7 rounded-full transition ${on ? "bg-primary/80" : "bg-foreground/20"}`}>
        <span className={`block h-3 w-3 rounded-full bg-white mt-0.5 transition ${on ? "ml-3.5" : "ml-0.5"}`} />
      </span>
    </button>
  );
}
