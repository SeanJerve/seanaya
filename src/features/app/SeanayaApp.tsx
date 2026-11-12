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
import { ART, Sparkle } from "@/components/seanaya/art";

/** Fixed page scenery: a band of clouds along the bottom, one lily and a few sparkles. */
function SkyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-[110px] opacity-95"
        style={{
          backgroundImage: `url(${ART.cloudBand})`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "auto 100%",
          backgroundPosition: "left bottom",
        }}
      />
      <img
        src={ART.lilyOpen}
        alt=""
        className="absolute -top-[46px] right-[max(338px,calc(50%-412px))] hidden w-[230px] -rotate-[18deg] opacity-95 xl:block"
      />
      <Sparkle className="absolute left-[78%] top-[38px] hidden h-7 w-7 text-white/90 lg:block" />
      <Sparkle className="absolute left-[53%] top-[34px] hidden h-3.5 w-3.5 text-white/80 lg:block" />
      <Sparkle className="absolute bottom-[34px] left-[32%] h-5 w-5 text-white/90" />
      <Sparkle className="absolute bottom-[50px] right-[30%] h-4 w-4 text-white/80" />
    </div>
  );
}

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
          table: "member_locations",
          filter: `relationship_id=eq.${currentRelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["member-locations"] });
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
        <div className="sn-card p-8 max-w-sm flex flex-col items-center shadow-soft">
          <div className="text-[12px] uppercase tracking-[0.25em] text-muted-foreground">
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
    <div className="min-h-[100dvh] w-full seanaya-bg flex relative overflow-x-clip">
      {tab !== "photobooth" && <SkyBackdrop />}

      <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-[1500px]">
      {/* Sidebar on wide screens; the floating dock carries navigation elsewhere */}
      {tab !== "photobooth" && <DesktopSidebar className="hidden xl:flex" />}

      <div className="relative flex min-w-0 flex-1 flex-col">
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
      </div>

      {tab !== "photobooth" && <BottomNav relationshipId={relId} />}

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
