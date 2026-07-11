import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Copy, Users } from "lucide-react";
import { useAppStore } from "@/features/app/store";
import { pinStorage, hashPin, ANNIVERSARY_ISO } from "@/features/pin/pin-utils";
import { FieldWrap, Input, PrimaryButton } from "./form-ui";

export function SettingsSheet({ relationshipId, inviteCode }: { relationshipId: string; inviteCode: string }) {
  const { user } = useUser();
  const { closeSheet } = useAppStore();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(pinStorage.getName() ?? "");
  const [joinCode, setJoinCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [anniversary, setAnniversary] = useState<string>("");

  const { data: rel } = useQuery({
    queryKey: ["settings-rel", relationshipId],
    queryFn: async () => (await supabase.from("relationships").select("*").eq("id", relationshipId).maybeSingle()).data,
  });

  useState(() => { if (rel?.anniversary) setAnniversary(rel.anniversary); return 0; });

  const saveName = useMutation({
    mutationFn: async () => {
      const n = displayName.trim();
      if (!n) throw new Error("Name is required");
      pinStorage.setName(n);
      if (user) await supabase.from("profiles").upsert({ id: user.id, display_name: n });
    },
    onSuccess: () => { toast.success("Name updated"); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  const savePin = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}$/.test(newPin)) throw new Error("Enter a 4-digit PIN");
      const h = await hashPin(newPin);
      pinStorage.set(h);
      if (user) await supabase.from("profiles").upsert({ id: user.id, pin_hash: h });
    },
    onSuccess: () => { setNewPin(""); toast.success("PIN updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  const saveAnn = useMutation({
    mutationFn: async () => {
      if (!anniversary) throw new Error("Pick a date");
      await supabase.from("relationships").update({ anniversary }).eq("id", relationshipId);
    },
    onSuccess: () => { toast.success("Anniversary saved"); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  const join = useMutation({
    mutationFn: async () => {
      if (!joinCode || !user) throw new Error("Missing code");
      const { data: found, error } = await supabase.from("relationships").select("*").eq("invite_code", joinCode.toUpperCase()).maybeSingle();
      if (error || !found) throw new Error("Invite not found");
      if (found.user_a_id === user.id) throw new Error("That's your own code");
      const { error: upErr } = await supabase.from("relationships").update({ user_b_id: user.id }).eq("id", found.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => { toast.success("Linked. Welcome home."); closeSheet(); setTimeout(() => window.location.reload(), 500); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionHead label="Your name" />
        <FieldWrap label="Displayed as"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></FieldWrap>
        <PrimaryButton onClick={() => saveName.mutate()}>Save name</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="PIN" />
        <FieldWrap label="New 4-digit PIN">
          <Input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" />
        </FieldWrap>
        <PrimaryButton onClick={() => savePin.mutate()}>Update PIN</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="Anniversary" />
        <FieldWrap label="The day it became official">
          <Input type="date" value={anniversary || rel?.anniversary || ANNIVERSARY_ISO} onChange={(e) => setAnniversary(e.target.value)} />
        </FieldWrap>
        <PrimaryButton onClick={() => saveAnn.mutate()}>Save anniversary</PrimaryButton>
      </section>

      <section className="space-y-3">
        <SectionHead label="Partner link" />
        {rel?.user_b_id ? (
          <div className="flex items-center gap-2 rounded-2xl bg-white/50 px-4 py-3 text-sm">
            <Users size={14} /> You are linked with your partner.
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white/50 px-4 py-3 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your invite code</div>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success("Copied"); }}
                className="mt-1 flex items-center gap-2 font-mono tracking-widest"
              >
                {inviteCode} <Copy size={12} />
              </button>
            </div>
            <FieldWrap label="Or join with their code">
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDEF" />
            </FieldWrap>
            <PrimaryButton onClick={() => join.mutate()}>Link us</PrimaryButton>
          </>
        )}
      </section>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>;
}
