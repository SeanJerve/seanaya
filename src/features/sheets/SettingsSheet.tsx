import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { pinStorage, hashPin, ANNIVERSARY_ISO, type Slot } from "@/features/pin/pin-utils";
import { Input } from "./form-ui";
import { useNotificationPrefs, type PrefKind } from "@/hooks/useNotificationPrefs";
import { uploadImage } from "@/lib/storage";

export function SettingsSheet({
  relationshipId,
  inviteCode,
}: {
  relationshipId: string;
  inviteCode: string;
}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(pinStorage.getName() ?? "");
  const [newPin, setNewPin] = useState("");
  const [anniversary, setAnniversary] = useState<string>("");
  const { prefs, set: setPref } = useNotificationPrefs();

  const slot: Slot = pinStorage.getSlot() ?? "a";

  const { data: myProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setUploadingAvatar(true);
      const { url } = await uploadImage("wall", relationshipId, file, `avatars/${user.id}`);
      await supabase.from("profiles").upsert({ id: user.id, avatar_url: url });
      toast.success("Profile picture updated!");
      refetchProfile();
      qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    try {
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      toast.success("Profile picture removed!");
      refetchProfile();
      qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove avatar");
    }
  };

  const { data: rel } = useQuery({
    queryKey: ["settings-rel", relationshipId],
    queryFn: async () =>
      (await supabase.from("relationships").select("*").eq("id", relationshipId).maybeSingle())
        .data,
  });

  useEffect(() => {
    if (rel?.anniversary) setAnniversary(rel.anniversary);
  }, [rel?.anniversary]);

  const saveName = useMutation({
    mutationFn: async () => {
      const n = displayName.trim();
      if (!n) throw new Error("Name is required");
      pinStorage.setName(n);
      const nameCol = slot === "a" ? { name_a: n } : { name_b: n };
      await supabase.from("relationships").update(nameCol).eq("id", relationshipId);
      if (user) await supabase.from("profiles").upsert({ id: user.id, display_name: n });
    },
    onSuccess: () => {
      toast.success("Name updated");
      qc.invalidateQueries();
    },
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
    onSuccess: () => {
      setNewPin("");
      toast.success("Your PIN was updated");
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const saveAnn = useMutation({
    mutationFn: async () => {
      if (!anniversary) throw new Error("Pick a date");
      await supabase.from("relationships").update({ anniversary }).eq("id", relationshipId);
    },
    onSuccess: () => {
      toast.success("Anniversary saved");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const yourName = slot === "a" ? rel?.name_a : rel?.name_b;
  const partnerName = slot === "a" ? rel?.name_b : rel?.name_a;

  const copy = (text: string, msg: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast.success(msg, { duration: 5000 });
  };

  const prefRows: { k: PrefKind; label: string }[] = [
    { k: "memory", label: "Memories" },
    { k: "event", label: "Moments" },
    { k: "trip", label: "Places" },
    { k: "note", label: "Notes" },
    { k: "song", label: "Songs" },
    { k: "hug", label: "Hugs" },
  ];

  return (
    <div className="divide-y divide-[#e7e4f3]">
      <Group label="Profile">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-white bg-[#e6eafc] shadow-[var(--shadow-pill)]">
            {myProfile?.avatar_url ? (
              <img src={myProfile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-serif text-[24px] font-semibold text-sn-navy">
                {displayName.slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            id="profile-pic-upload"
            className="sr-only"
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
          />
          <label htmlFor="profile-pic-upload" className="sn-pill h-10 px-4 text-[14px]">
            <Upload size={15} strokeWidth={1.9} />
            {uploadingAvatar ? "Uploading…" : myProfile?.avatar_url ? "Change photo" : "Add photo"}
          </label>
          {myProfile?.avatar_url && (
            <button onClick={handleRemoveAvatar} className="sn-ghost h-10 px-4 text-[14px]">
              Remove
            </button>
          )}
        </div>
        <Row label="Name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <button onClick={() => saveName.mutate()} disabled={saveName.isPending} className="sn-pill h-12 shrink-0 px-5 text-[14.5px]">
            Save
          </button>
        </Row>
      </Group>

      <Group label="Anniversary">
        <Row>
          <Input type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} />
          <button onClick={() => saveAnn.mutate()} disabled={saveAnn.isPending} className="sn-pill h-12 shrink-0 px-5 text-[14.5px]">
            Save
          </button>
        </Row>
      </Group>

      <Group label={`Notify me when ${partnerName || "my partner"} adds`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {prefRows.map(({ k, label }) => (
            <Switch key={k} label={label} on={prefs[k]} onToggle={(v) => setPref({ [k]: v })} />
          ))}
        </div>
      </Group>

      <Group label="Your PIN">
        <Row>
          <Input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="New 4-digit PIN"
          />
          <button onClick={() => savePin.mutate()} disabled={savePin.isPending} className="sn-pill h-12 shrink-0 px-5 text-[14.5px]">
            Update
          </button>
        </Row>
      </Group>

      <Group label="Links">
        <div className="flex flex-wrap gap-2.5">
          {!rel?.user_b_id && (
            <button
              onClick={() =>
                copy(`${window.location.origin}/?invite=${inviteCode || rel?.invite_code || ""}`, "Invite link copied")
              }
              className="sn-pill h-11 px-5 text-[14.5px]"
            >
              Copy invite link
            </button>
          )}
          <button
            onClick={() => {
              const partnerSlot = slot === "a" ? "b" : "a";
              const d = anniversary || rel?.anniversary || ANNIVERSARY_ISO;
              copy(`${window.location.origin}/?reset=${partnerSlot}&date=${d}`, "PIN reset link copied");
            }}
            className="sn-pill h-11 px-5 text-[14.5px]"
          >
            Copy PIN reset link for {partnerName || "partner"}
          </button>
        </div>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 py-6 first:pt-1 last:pb-2">
      <h3 className="sn-label">{label}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="mb-2 text-[13px] font-semibold text-sn-ink">{label}</div>}
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  );
}

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      className="flex h-12 items-center justify-between gap-3 text-left text-[15px] text-sn-navy"
    >
      {label}
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border border-white/80 transition-colors ${on ? "bg-[radial-gradient(circle_at_35%_30%,#c9d8fd,#94b2f6_75%)]" : "bg-[#e3e5f1]"}`}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(60,80,150,0.35)] transition-[left] ${on ? "left-[24px]" : "left-[3px]"}`}
        />
      </span>
    </button>
  );
}
