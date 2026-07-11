import { Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";

export function AppHeader({ title, subtitle, relationshipId }: { title: string; subtitle?: string; relationshipId?: string }) {
  const { user } = useUser();
  const qc = useQueryClient();

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
    <header
      className="sticky top-0 z-20 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3
        backdrop-blur-2xl bg-background/40 border-b border-white/30"
    >
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seanaya</div>
          <h1 className="display truncate text-2xl leading-tight">{title}</h1>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {relationshipId && (
          <button
            onClick={() => hug.mutate()}
            aria-label="Send a hug"
            className="relative h-11 w-11 shrink-0 rounded-full border border-white/50 backdrop-blur-xl
              bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),rgba(255,220,225,0.35)_65%)]
              shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_8px_22px_-10px_rgba(200,80,90,0.4)]
              flex items-center justify-center active:scale-95 transition"
          >
            <Heart size={18} className="text-hug" fill="currentColor" />
          </button>
        )}
      </div>
    </header>
  );
}
