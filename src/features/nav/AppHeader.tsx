import { Heart, Bell } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppStore } from "@/features/app/store";

export function AppHeader({ title, subtitle, relationshipId }: { title: string; subtitle?: string; relationshipId?: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const { openSheet } = useAppStore();
  const { unread } = useNotifications(relationshipId);

  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase.from("hugs").insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("A hug on its way"); qc.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Try again"),
  });

  return (
    <header className="sticky top-0 z-20 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur-2xl bg-background/40 border-b border-white/30">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Seanaya</div>
          <h1 className="display text-lg leading-tight">{title}</h1>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openSheet("notifications")}
            className="relative rounded-full border border-white/50 bg-white/50 p-2 backdrop-blur-xl"
            aria-label="Notifications"
          >
            <Bell size={16} className="text-foreground/70" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-[color:var(--hug)] px-1 text-[9px] font-semibold text-white text-center leading-4">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          <button
            onClick={() => hug.mutate()}
            className="rounded-full border border-white/50 bg-white/50 p-2 backdrop-blur-xl transition active:scale-95"
            aria-label="Send a hug"
          >
            <Heart size={16} className="text-[color:var(--hug)]" />
          </button>
        </div>
      </div>
    </header>
  );
}
