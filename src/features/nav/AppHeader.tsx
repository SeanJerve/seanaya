import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { useAppStore } from "@/features/app/store";
import { useCoupleNames } from "@/hooks/useCouple";
import { chibiFor } from "@/components/seanaya/art";

const SUBTITLES: Record<string, string> = {
  Home: "another day, another page in our story",
  Memories: "every little thing, kept by date",
  Album: "the pages we keep coming back to",
  "Love Wall": "notes we leave for each other",
  Stickers: "tiny pieces of us",
  "Pet Room": "where the little ones live",
};

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
  const { me: userName, partner } = useCoupleNames();

  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase
        .from("hugs")
        .insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Hug sent to ${partner}`);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  const isHome = title.toLowerCase() === "home";
  const heading = isHome ? `Welcome back, ${userName}.` : title;
  const sub = subtitle ?? SUBTITLES[title];


  const actions = (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <button
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30, 70]);
          hug.mutate();
        }}
        disabled={hug.isPending}
        className="sn-pill sn-icon-btn h-11 w-11 sm:h-[52px] sm:w-[52px]"
        aria-label="Send a hug"
        title="Send a warm hug"
      >
        <Heart size={21} strokeWidth={1.9} />
      </button>

      <button
        onClick={() => openSheet("settings")}
        className="h-11 w-11 overflow-hidden rounded-full border-[3px] border-white shadow-[var(--shadow-pill)] transition active:scale-95 sm:h-[52px] sm:w-[52px]"
        aria-label="Account and settings"
        title="Account & Settings"
      >
        <img
          src={chibiFor(userName)}
          alt=""
          className="h-full w-full scale-[1.3] object-cover object-[50%_62%]"
        />
      </button>
    </div>
  );

  return (
    <header className="relative z-20 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
      {/* Phone: wordmark + actions on their own row */}
      <div className="mb-4 flex items-center justify-between sm:hidden">
        <span className="font-serif text-[19px] font-medium tracking-[0.16em] text-[#38457c]">
          SEANAYA
        </span>
        {actions}
      </div>
      <div className="mx-auto flex max-w-[592px] items-start justify-between gap-4 lg:max-w-[1138px]">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          className="min-w-0 pt-1"
        >
          <h1 className="flex items-center gap-2.5 font-serif text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-sn-navy sm:text-[34px] lg:text-[40px]">
            <span className="truncate">{heading}</span>
          </h1>
          {sub && (
            <p className="sn-hand mt-1.5 flex items-center gap-2 text-[19px] leading-tight text-[#646d93] sm:text-[22px] lg:text-[25px]">
              <span className="truncate">{sub}</span>
            </p>
          )}
        </motion.div>

        <div className="hidden sm:block">{actions}</div>
      </div>
    </header>
  );
}
