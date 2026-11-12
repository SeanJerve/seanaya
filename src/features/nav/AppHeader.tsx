import { Heart, Bell, Settings } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppStore } from "@/features/app/store";

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

  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase
        .from("hugs")
        .insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("A hug on its way");
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  return (
    <header className="sticky top-0 z-20 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur-2xl bg-background/40 border-b border-white/30">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Seanaya
          </div>
          <h1 className="display text-lg leading-tight">{title}</h1>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([30, 70]);
              }
              hug.mutate();
            }}
            className="btn-press w-9 h-9 rounded-full border border-white/50 bg-white/60 dark:bg-black/30 backdrop-blur-xl flex items-center justify-center transition active:scale-90 hover:bg-white/80 shadow-xs"
            aria-label="Send a hug"
            title="Send a warm hug"
          >
            <Heart size={17} className="text-[color:var(--hug)] fill-[color:var(--hug)]/30" />
          </button>
          <button
            onClick={() => openSheet("notifications")}
            className="btn-press relative w-9 h-9 rounded-full border border-white/50 bg-white/60 dark:bg-black/30 backdrop-blur-xl flex items-center justify-center transition active:scale-95 hover:bg-white/80 shadow-xs"
            aria-label="Notifications"
          >
            <Bell size={17} className="text-foreground/75" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[17px] h-[17px] rounded-full bg-[color:var(--hug)] px-1 text-[9px] font-bold text-white flex items-center justify-center leading-none shadow-sm animate-pulse">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          <button
            onClick={() => openSheet("settings")}
            className="btn-press w-9 h-9 rounded-full border border-white/50 bg-white/60 dark:bg-black/30 backdrop-blur-xl flex items-center justify-center transition active:scale-95 hover:bg-white/80 shadow-xs"
            aria-label="Settings"
          >
            <Settings size={17} className="text-foreground/75" />
          </button>
        </div>
      </div>
    </header>
  );
}
