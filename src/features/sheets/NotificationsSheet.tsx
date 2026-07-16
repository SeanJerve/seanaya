import { useEffect } from "react";
import { useNotifications, type NotifKind } from "@/hooks/useNotifications";
import { useAppStore, type TabKey } from "@/features/app/store";
import { formatDistanceToNow } from "date-fns";
import { BookHeart, Calendar, Music2, PinIcon, MapPin, Heart, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const ICON: Record<NotifKind, React.ReactNode> = {
  memory: <BookHeart size={14} />,
  event: <Calendar size={14} />,
  note: <PinIcon size={14} />,
  trip: <MapPin size={14} />,
  song: <Music2 size={14} />,
  hug: <Heart size={14} />,
  capsule: <BookHeart size={14} />,
};

const TAB_FOR: Partial<Record<NotifKind, TabKey>> = {
  memory: "memories", event: "calendar", note: "wall", trip: "pet", song: "pet",
};

const TITLE: Record<NotifKind, string> = {
  memory: "New memory kept",
  event: "New moment on the calendar",
  note: "New note on the wall",
  trip: "New place pinned",
  song: "New song on the radio",
  hug: "A hug arrived",
  capsule: "A time capsule was placed",
};

const SUB: Record<NotifKind, string> = {
  memory: "Open memories to see it",
  event: "Peek at the calendar",
  note: "Take a look at the wall",
  trip: "See it on your places list",
  song: "Play it from the radio",
  hug: "Sent with love",
  capsule: "Waiting until it opens",
};

export function NotificationsSheet({ relationshipId }: { relationshipId: string }) {
  const { list, unread, markAllRead, markOneRead } = useNotifications(relationshipId);
  const { setTab, closeSheet } = useAppStore();

  // Auto-mark on view (small grace so the ring is visible for a beat)
  useEffect(() => { const t = setTimeout(() => { markAllRead(); }, 1200); return () => clearTimeout(t); }, [markAllRead]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {unread > 0 ? `${unread} new whisper${unread === 1 ? "" : "s"}` : "All caught up"}
        </div>
        {list.length > 0 && (
          <button
            onClick={() => { markAllRead(); toast.success("Cleared"); }}
            className="flex items-center gap-1 rounded-full border border-white/50 bg-white/50 px-3 py-1 text-[11px] text-foreground/80 backdrop-blur-xl"
          >
            <CheckCheck size={12} /> Mark all as read
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No whispers yet.</div>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => {
            const tab = TAB_FOR[n.kind];
            return (
              <li key={n.id}>
                <button
                  onClick={() => { markOneRead(n.id); if (tab) setTab(tab); closeSheet(); }}
                  className={`flex w-full items-start gap-3 rounded-2xl border border-white/40 bg-white/50 px-4 py-3 text-left backdrop-blur-xl transition ${!n.read ? "ring-1 ring-primary/30" : ""}`}
                >
                  <span className="mt-0.5 rounded-full bg-white/60 p-1.5 text-foreground/70">{ICON[n.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{TITLE[n.kind]}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{SUB[n.kind]}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--hug)]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
