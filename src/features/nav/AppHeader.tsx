import { Heart, Bell, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppStore } from "@/features/app/store";
import { pinStorage } from "@/features/pin/pin-utils";
import { CuteBoyAvatar } from "@/components/kawaii/KawaiiIllustrations";

export function AppHeader({
  title,
  subtitle,
  relationshipId,
}: {
  title: string;
  subtitle?: string;
  relationshipId?: string;
}) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { openSheet } = useAppStore();
  const { unread } = useNotifications(relationshipId);
  const userName = pinStorage.getName() ?? "Sean";

  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase
        .from("hugs")
        .insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("A warm hug is on its way ♡");
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const isHome = title.toLowerCase() === "home";

  return (
    <header className="sticky top-0 z-20 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-2xl bg-white/40 border-b border-white/60 shadow-[0_4px_20px_-4px_rgba(186,215,255,0.25)]">
      <div className="mx-auto flex max-w-md md:max-w-4xl lg:max-w-6xl items-center justify-between gap-4">
        {/* Left Side: Editorial Greeting / Title */}
        <div className="min-w-0">
          {isHome ? (
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#233554] flex items-center gap-1.5">
                <span>Welcome back, {userName}.</span>
                <span className="text-pink-400 font-normal">♡</span>
              </h1>
              <p className="font-serif italic text-xs sm:text-sm text-sky-800/70 tracking-wide">
                another day, another page in our story ♡
              </p>
            </div>
          ) : (
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#334e68] font-bold">
                Seanaya
              </div>
              <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#233554] flex items-center gap-1.5">
                <span>{title}</span>
                <span className="text-pink-400 font-normal">♡</span>
              </h1>
              {subtitle && <div className="text-xs text-sky-800/70 mt-0.5">{subtitle}</div>}
            </div>
          )}
        </div>

        {/* Right Side: Header Control Capsule */}
        <div className="flex items-center gap-2">
          {/* Quick Search / Memory trigger */}
          <button
            onClick={() => openSheet("add-memory")}
            className="w-9 h-9 rounded-full border border-white/80 bg-white/80 hover:bg-white text-slate-600 flex items-center justify-center transition active:scale-90 shadow-2xs cursor-pointer"
            aria-label="Add memory or search"
            title="Add memory or browse"
          >
            <Search size={16} />
          </button>

          {/* Pink Heart Hug Trigger */}
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([30, 70]);
              }
              hug.mutate();
            }}
            disabled={hug.isPending}
            className="w-9 h-9 rounded-full border border-pink-200 bg-pink-100/90 hover:bg-pink-200/90 text-pink-600 flex items-center justify-center transition active:scale-90 shadow-2xs cursor-pointer"
            aria-label="Send a hug"
            title="Send a warm hug ♡"
          >
            <Heart size={16} className="fill-pink-400 text-pink-500" />
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => openSheet("notifications")}
            className="relative w-9 h-9 rounded-full border border-white/80 bg-white/80 hover:bg-white text-slate-600 flex items-center justify-center transition active:scale-95 shadow-2xs cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[17px] h-[17px] rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white flex items-center justify-center leading-none shadow-xs animate-pulse">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* User Avatar Capsule -> Opens Settings */}
          <button
            onClick={() => openSheet("settings")}
            className="w-9 h-9 rounded-full p-0.5 border border-white/80 bg-white shadow-2xs hover:scale-105 active:scale-95 transition cursor-pointer overflow-hidden flex items-center justify-center"
            aria-label="Open settings"
            title="Account & Settings"
          >
            <div className="w-full h-full rounded-full overflow-hidden scale-110">
              <CuteBoyAvatar />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
