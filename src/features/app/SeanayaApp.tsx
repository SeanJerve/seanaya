import { useEffect } from "react";
import { PinGate } from "@/features/pin/PinGate";
import { useRelationship } from "@/hooks/useRelationship";
import { useAppStore } from "./store";
import { AppHeader } from "@/features/nav/AppHeader";
import { BottomNav } from "@/features/nav/BottomNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HomeView } from "@/features/views/HomeView";
import { CalendarView } from "@/features/views/CalendarView";
import { MemoriesView } from "@/features/views/MemoriesView";
import { WallView } from "@/features/views/WallView";
import { StickersView } from "@/features/views/StickersView";
import { PetView } from "@/features/views/PetView";
import { PhotoBoothView } from "@/features/photobooth/PhotoBoothView";
import { Sheet } from "./Sheet";
import { AddMemorySheet } from "@/features/sheets/AddMemorySheet";
import { AddEventSheet } from "@/features/sheets/AddEventSheet";
import { AddNoteSheet } from "@/features/sheets/AddNoteSheet";
import { AddTripSheet } from "@/features/sheets/AddTripSheet";
import { AddSongSheet } from "@/features/sheets/AddSongSheet";
import { SettingsSheet } from "@/features/sheets/SettingsSheet";
import { NotificationsSheet } from "@/features/sheets/NotificationsSheet";
import { AddStickerSheet } from "@/features/sheets/AddStickerSheet";
import { HugOverlay } from "@/features/panels/HugOverlay";
import { ConfirmDialog } from "./ConfirmDialog";
import { MonthsaryWrapped } from "@/features/monthsary/MonthsaryWrapped";
import { bootTheme } from "@/lib/theme";

export function SeanayaApp() {
  useEffect(() => {
    bootTheme();
  }, []);
  return (
    <PinGate>
      <Inner />
    </PinGate>
  );
}

function Inner() {
  const { data: rel, isLoading, isError, refetch } = useRelationship();
  const { tab, sheet, isMonthsaryOpen } = useAppStore();
  const qc = useQueryClient();

  const currentRelId = rel?.id;

  useEffect(() => {
    if (!currentRelId) return;
    const channelId = `realtime-sync-${currentRelId}-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase.channel(channelId);

    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notes",
        filter: `relationship_id=eq.${currentRelId}`,
      },
      () => {
        qc.invalidateQueries({ queryKey: ["notes"] });
        qc.invalidateQueries({ queryKey: ["latest-note"] });
        qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
      },
    )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stickers",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["stickers"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sticker_pages",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["sticker-pages"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pets",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["pets"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships", filter: `id=eq.${currentRelId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["settings-rel"] });
          qc.invalidateQueries({ queryKey: ["relationship"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memories",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["memories"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["events"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["trips"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "songs",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["songs"] });
          qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hugs",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["hugs"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
          qc.invalidateQueries({ queryKey: ["recent-partner-action"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentRelId, qc]);

  const fallbackRelId =
    typeof window !== "undefined" ? localStorage.getItem("seanaya.rel_id") : null;
  const isUrlPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "true";

  const effectiveRel =
    rel ||
    (isUrlPreview
      ? {
          id: "cdb0c647-18fe-4e07-9d90-66b83298bc47",
          user_a_id: "preview-a",
          user_b_id: "preview-b",
          name: "Seanaya",
          name_a: "Sean",
          name_b: "Aya",
          anniversary: "2026-06-19",
          invite_code: "SEANAYA",
        }
      : null);

  const activeRelId = effectiveRel?.id || fallbackRelId || "";

  if (isMonthsaryOpen && activeRelId) {
    return (
      <div className="min-h-[100dvh] w-full seanaya-bg">
        <MonthsaryWrapped relationshipId={activeRelId} />
      </div>
    );
  }

  if (!isUrlPreview && isLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="text-sm text-muted-foreground animate-pulse">Preparing your space…</div>
      </div>
    );
  }

  if (!isUrlPreview && (isError || !effectiveRel)) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="rounded-3xl border border-white/50 bg-white/40 backdrop-blur-xl p-8 max-w-sm flex flex-col items-center shadow-soft">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Seanaya
          </div>
          <h2 className="display mt-2 text-2xl">Waking your space</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            The database took a moment to respond. Tap below to reconnect.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-6 rounded-full border border-white/50 bg-white/40 backdrop-blur-xl px-7 py-2.5 text-sm text-foreground hover:bg-white/60 active:scale-95 transition shadow-sm font-medium"
          >
            Retry now
          </button>
        </div>
      </div>
    );
  }

  const relId = effectiveRel?.id || "";
  const inviteCode = effectiveRel?.invite_code ?? "";

  const headerTitle = (
    {
      home: "Home",
      calendar: "Memories",
      memories: "Album",
      wall: "Love Wall",
      stickers: "Stickers",
      pet: "Pet Room",
      photobooth: "Photo Booth",
    } as const
  )[tab];

  return (
    <div className="min-h-[100dvh] w-full seanaya-bg flex relative overflow-x-hidden">
      {/* Dreamy Floral Watermarks matching Reference Scrapbook */}
      <div className="fixed top-0 right-0 w-72 sm:w-96 h-72 sm:h-96 pointer-events-none opacity-30 select-none z-0 translate-x-16 -translate-y-10">
        <img src="/main-lily.png" alt="" className="w-full h-full object-contain" />
      </div>
      <div className="fixed bottom-0 right-0 w-80 sm:w-[28rem] h-80 sm:h-[28rem] pointer-events-none opacity-25 select-none z-0 translate-x-20 translate-y-16">
        <img src="/lily1.png" alt="" className="w-full h-full object-contain" />
      </div>

      {/* Desktop Sidebar (visible on xl: screens, hidden on mobile/tablet) */}
      {tab !== "photobooth" && <DesktopSidebar className="hidden xl:flex relative z-20" />}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {tab !== "photobooth" && <AppHeader title={headerTitle} relationshipId={relId} />}

        <main className="flex-1">
          {tab === "home" && <HomeView relationshipId={relId} anniversary={effectiveRel?.anniversary ?? null} />}
          {tab === "calendar" && <CalendarView relationshipId={relId} />}
          {tab === "memories" && <MemoriesView relationshipId={relId} />}
          {tab === "wall" && <WallView relationshipId={relId} />}
          {tab === "stickers" && <StickersView relationshipId={relId} />}
          {tab === "pet" && <PetView relationshipId={relId} />}
          {tab === "photobooth" && <PhotoBoothView relationshipId={relId} />}
        </main>
      </div>

      {/* Floating Bottom Nav (active on mobile/tablet, hidden on desktop xl: where sidebar is used) */}
      {tab !== "photobooth" && (
        <div className="xl:hidden">
          <BottomNav relationshipId={relId} />
        </div>
      )}

      <Sheet open={sheet === "add-memory"} title="New memory">
        <AddMemorySheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-event"} title="New event">
        <AddEventSheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-note"} title="New note">
        <AddNoteSheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-trip"} title="New place">
        <AddTripSheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-song"} title="New song">
        <AddSongSheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "settings"} title="Settings">
        <SettingsSheet relationshipId={relId} inviteCode={inviteCode} />
      </Sheet>
      <Sheet open={sheet === "notifications"} title="Whispers">
        <NotificationsSheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-sticker"} title="New sticker">
        <AddStickerSheet relationshipId={relId} />
      </Sheet>

      <HugOverlay relationshipId={relId} />
      <ConfirmDialog />
      <MonthsaryWrapped relationshipId={relId} />
    </div>
  );
}
