import { useEffect } from "react";
import { useNotifications, type NotifKind } from "@/hooks/useNotifications";
import { useAppStore, type TabKey } from "@/features/app/store";
import { formatDistanceToNow } from "date-fns";
import { BookHeart, Calendar, Music2, PinIcon, MapPin, Heart } from "lucide-react";

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
  memory: "memories", event: "calendar", note: "wall", trip: "more", song: "more",
};

const LABEL: Record<NotifKind, string> = {
  memory: "A new memory was kept",
  event: "A new moment on the calendar",
  note: "A new note on the wall",
  trip: "A new place was pinned",
  song: "A song was added to the radio",
  hug: "A hug arrived",
  capsule: "A time capsule was placed",
};

export function NotificationsSheet({ relationshipId }: { relationshipId: string }) {
  const { list, markAllRead, markOneRead } = useNotifications(relationshipId);
  const { setTab, closeSheet } = useAppStore();

  useEffect(() => { const t = setTimeout(() => { markAllRead(); }, 800); return () => clearTimeout(t); }, [markAllRead]);

  if (list.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No new whispers yet.</div>;
  }
  return (
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
                <div className="truncate text-sm">{LABEL[n.kind]}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--hug)]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
