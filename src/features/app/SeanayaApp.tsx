import { useEffect } from "react";
import { PinGate } from "@/features/pin/PinGate";
import { useRelationship } from "@/hooks/useRelationship";
import { useAppStore } from "./store";
import { AppHeader } from "@/features/nav/AppHeader";
import { BottomNav } from "@/features/nav/BottomNav";
import { HomeView } from "@/features/views/HomeView";
import { CalendarView } from "@/features/views/CalendarView";
import { MemoriesView } from "@/features/views/MemoriesView";
import { WallView } from "@/features/views/WallView";
import { MoreView } from "@/features/views/MoreView";
import { Sheet } from "./Sheet";
import { AddMemorySheet } from "@/features/sheets/AddMemorySheet";
import { AddEventSheet } from "@/features/sheets/AddEventSheet";
import { AddNoteSheet } from "@/features/sheets/AddNoteSheet";
import { AddTripSheet } from "@/features/sheets/AddTripSheet";
import { AddSongSheet } from "@/features/sheets/AddSongSheet";
import { SettingsSheet } from "@/features/sheets/SettingsSheet";
import { NotificationsSheet } from "@/features/sheets/NotificationsSheet";
import { StickersSheet } from "@/features/sheets/StickersSheet";
import { HugOverlay } from "@/features/panels/HugOverlay";
import { ConfirmDialog } from "./ConfirmDialog";
import { bootTheme } from "@/lib/theme";

export function SeanayaApp() {
  useEffect(() => { bootTheme(); }, []);
  return (
    <PinGate>
      <Inner />
    </PinGate>
  );
}

function Inner() {
  const { data: rel, isLoading } = useRelationship();
  const { tab, sheet } = useAppStore();

  if (isLoading || !rel) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--gradient-sky)" }}>
        <div className="text-sm text-muted-foreground">Preparing your space…</div>
      </div>
    );
  }

  const relId = rel.id;
  const inviteCode = rel.invite_code ?? "";

  const headerTitle = ({ home: "Home", calendar: "Calendar", memories: "Memories", wall: "Wall", more: "More" } as const)[tab];

  return (
    <div className="min-h-[100dvh] w-full seanaya-bg">
      <AppHeader title={headerTitle} relationshipId={relId} />

      <main>
        {tab === "home" && <HomeView relationshipId={relId} anniversary={rel.anniversary} />}
        {tab === "calendar" && <CalendarView relationshipId={relId} />}
        {tab === "memories" && <MemoriesView relationshipId={relId} />}
        {tab === "wall" && <WallView relationshipId={relId} />}
        {tab === "more" && <MoreView relationshipId={relId} />}
      </main>

      <BottomNav relationshipId={relId} />

      <Sheet open={sheet === "add-memory"} title="New memory"><AddMemorySheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "add-event"}  title="New event"><AddEventSheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "add-note"}   title="New note"><AddNoteSheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "add-trip"}   title="New place"><AddTripSheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "add-song"}   title="New song"><AddSongSheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "settings"}   title="Settings"><SettingsSheet relationshipId={relId} inviteCode={inviteCode} /></Sheet>
      <Sheet open={sheet === "notifications"} title="Whispers"><NotificationsSheet relationshipId={relId} /></Sheet>
      <Sheet open={sheet === "stickers"} title="Sticker Pad"><StickersSheet relationshipId={relId} /></Sheet>

      <HugOverlay relationshipId={relId} />
      <ConfirmDialog />
    </div>
  );
}
