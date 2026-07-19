import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Sunset,
  Bell,
  BookHeart,
  Calendar,
  MapPin,
  PinIcon,
  Music2,
  Heart,
  Upload,
} from "lucide-react";
import { pinStorage, hashPin, ANNIVERSARY_ISO, type Slot } from "@/features/pin/pin-utils";
import { FieldWrap, Input, PrimaryButton } from "./form-ui";
import { useTheme, type Theme } from "@/lib/theme";
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
  const [theme, setTheme] = useTheme();
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

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl bg-white/50 p-4 border border-white/30 backdrop-blur-xl">
        <SectionHead label="Your Profile" />

        {/* Profile Picture and Info Row */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full bg-white/60 border border-white/50 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
            {myProfile?.avatar_url ? (
              <img
                src={myProfile.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-foreground/45">
                {displayName.slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              type="file"
              accept="image/*"
              id="profile-pic-upload"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <div className="flex gap-2">
              <label
                htmlFor="profile-pic-upload"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-white/50 bg-white/70 hover:bg-white/80 active:scale-95 transition-all cursor-pointer shadow-sm text-foreground/80"
              >
                <Upload size={12} className="mr-1.5" />
                {uploadingAvatar ? "Uploading..." : "Upload photo"}
              </label>
              {myProfile?.avatar_url && (
                <button
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-red-200/50 bg-red-50/70 hover:bg-red-50/80 active:scale-95 transition-all cursor-pointer shadow-sm text-red-500"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Upload a profile picture to show next to your activity.
            </p>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="space-y-3 pt-2 border-t border-white/20">
          <FieldWrap label="Displayed as">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </FieldWrap>
          <PrimaryButton onClick={() => saveName.mutate()}>Save profile</PrimaryButton>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Theme" />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTheme("light")}
            className="flex flex-col items-center gap-1 rounded-2xl border border-primary/60 bg-white/70 px-3 py-3 text-xs backdrop-blur-xl transition cursor-pointer"
          >
            <span className="text-foreground/70">
              <Sun size={14} />
            </span>
            Light
          </button>
          <button
            disabled
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-xs backdrop-blur-xl opacity-50 cursor-not-allowed text-muted-foreground/60"
          >
            <span>
              <Moon size={14} />
            </span>
            Dark (Work in progress)
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Whispers" icon={<Bell size={11} />} />
        <p className="text-[11px] text-muted-foreground">
          Choose which of your partner's moments should notify you.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PrefRow
            k="memory"
            label="Memories"
            icon={<BookHeart size={14} />}
            on={prefs.memory}
            onToggle={(v) => setPref({ memory: v })}
          />
          <PrefRow
            k="event"
            label="Events"
            icon={<Calendar size={14} />}
            on={prefs.event}
            onToggle={(v) => setPref({ event: v })}
          />
          <PrefRow
            k="trip"
            label="Places"
            icon={<MapPin size={14} />}
            on={prefs.trip}
            onToggle={(v) => setPref({ trip: v })}
          />
          <PrefRow
            k="note"
            label="Notes"
            icon={<PinIcon size={14} />}
            on={prefs.note}
            onToggle={(v) => setPref({ note: v })}
          />
          <PrefRow
            k="song"
            label="Songs"
            icon={<Music2 size={14} />}
            on={prefs.song}
            onToggle={(v) => setPref({ song: v })}
          />
          <PrefRow
            k="hug"
            label="Hugs"
            icon={<Heart size={14} />}
            on={prefs.hug}
            onToggle={(v) => setPref({ hug: v })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHead label="Your PIN" />
        <p className="text-[11px] text-muted-foreground">
          This changes only your PIN. Your partner's PIN stays the same.
        </p>
        <FieldWrap label="New 4-digit PIN">
          <Input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="••••"
          />
        </FieldWrap>
        <PrimaryButton onClick={() => savePin.mutate()}>Update PIN</PrimaryButton>
      </section>

      {!rel?.user_b_id && (
        <section className="space-y-3">
          <SectionHead label="Invitation Link" />
          <p className="text-[11px] text-muted-foreground">
            Share this link with your partner so they can join your space.
          </p>
          <PrimaryButton
            onClick={() => {
              const code = inviteCode || rel?.invite_code || "";
              const link = `${window.location.origin}/?invite=${code}`;
              if (
                typeof navigator !== "undefined" &&
                navigator.clipboard &&
                navigator.clipboard.writeText
              ) {
                navigator.clipboard.writeText(link).catch(() => {});
              }
              toast.success("Invitation link copied to clipboard!", { duration: 6000 });
            }}
          >
            Copy invitation link
          </PrimaryButton>
        </section>
      )}

      <section className="space-y-3">
        <SectionHead label="Partner's PIN" />
        <p className="text-[11px] text-muted-foreground">
          If your partner forgot their PIN, you can generate a reset link for them.
        </p>
        <PrimaryButton
          onClick={() => {
            const partnerSlot = slot === "a" ? "b" : "a";
            const d = anniversary || rel?.anniversary || ANNIVERSARY_ISO;
            const link = `${window.location.origin}/?reset=${partnerSlot}&date=${d}`;
            if (
              typeof navigator !== "undefined" &&
              navigator.clipboard &&
              navigator.clipboard.writeText
            ) {
              navigator.clipboard.writeText(link).catch(() => {});
            }
            toast.success("Reset link copied! Send it to your partner.", { duration: 6000 });
          }}
        >
          Copy Reset Link
        </PrimaryButton>
      </section>
    </div>
  );
}

function SectionHead({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}
function PrefRow({
  k: _k,
  label,
  icon,
  on,
  onToggle,
}: {
  k: PrefKind;
  label: string;
  icon: React.ReactNode;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!on)}
      className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-sm backdrop-blur-xl transition ${on ? "border-primary/60 bg-white/70" : "border-white/40 bg-white/40 text-foreground/60"}`}
    >
      <span className="flex items-center gap-2">
        <span className="text-foreground/70">{icon}</span>
        {label}
      </span>
      <span
        className={`h-4 w-7 rounded-full transition ${on ? "bg-primary/80" : "bg-foreground/20"}`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-white mt-0.5 transition ${on ? "ml-3.5" : "ml-0.5"}`}
        />
      </span>
    </button>
  );
}
