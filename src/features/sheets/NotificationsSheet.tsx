import { useEffect } from "react";
import { useNotifications, type NotifKind } from "@/hooks/useNotifications";
import { useAppStore, type TabKey } from "@/features/app/store";
import { formatDistanceToNow } from "date-fns";
import { BookHeart, Calendar, Music2, PinIcon, MapPin, Heart, CheckCheck } from "lucide-react";
import { toast } from "sonner";

const ICON: Record<NotifKind, React.ReactNode> = {
  memory: <BookHeart size={17} strokeWidth={1.7} />,
  event: <Calendar size={17} strokeWidth={1.7} />,
  note: <PinIcon size={17} strokeWidth={1.7} />,
  trip: <MapPin size={17} strokeWidth={1.7} />,
  song: <Music2 size={17} strokeWidth={1.7} />,
  hug: <Heart size={17} strokeWidth={1.7} />,
  capsule: <BookHeart size={17} strokeWidth={1.7} />,
};

const TAB_FOR: Partial<Record<NotifKind, TabKey>> = {
  memory: "memories",
  event: "calendar",
  note: "wall",
  trip: "pet",
  song: "pet",
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


export function NotificationsSheet({ relationshipId }: { relationshipId: string }) {
  const { list, unread, markAllRead, markOneRead } = useNotifications(relationshipId);
  const { setTab, closeSheet } = useAppStore();

  // Auto-mark on view (small grace so the ring is visible for a beat)
  useEffect(() => {
    const t = setTimeout(() => {
      markAllRead();
    }, 1200);
    return () => clearTimeout(t);
  }, [markAllRead]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-sn-muted">
          {unread > 0 ? `${unread} new` : "All caught up"}
        </span>
        {list.length > 0 && unread > 0 && (
          <button
            onClick={() => {
              markAllRead();
              toast.success("All marked as read");
            }}
            className="sn-ghost h-9 px-3.5 text-[13.5px]"
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center font-serif text-[19px] text-sn-muted">Nothing new yet</div>
      ) : (
        <ul className="mt-3 divide-y divide-[#e7e4f3]">
          {list.map((n) => {
            const tab = TAB_FOR[n.kind];
            return (
              <li key={n.id}>
                <button
                  onClick={() => {
                    markOneRead(n.id);
                    if (tab) setTab(tab);
                    closeSheet();
                  }}
                  className="flex w-full items-center gap-3.5 py-3.5 text-left"
                >
                  <span className={`sn-pill sn-icon-btn h-10 w-10 cursor-pointer ${!n.read ? "sn-active" : ""}`}>
                    {ICON[n.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-sn-navy">{TITLE[n.kind]}</div>
                    <div className="mt-0.5 text-[13px] text-sn-muted">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  {!n.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sn-pink" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
