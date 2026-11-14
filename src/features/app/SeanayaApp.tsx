import { lazy, Suspense, useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";
import { PinGate } from "@/features/pin/PinGate";
import { useRelationship } from "@/hooks/useRelationship";
import { useAppStore } from "./store";
import { AppHeader } from "@/features/nav/AppHeader";
import { BottomNav } from "@/features/nav/BottomNav";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HomeView } from "@/features/views/HomeView";
// Secondary sections load on first visit, keeping the first paint light.
const CalendarView = lazy(() => import("@/features/views/CalendarView").then((m) => ({ default: m.CalendarView })));
const MemoriesView = lazy(() => import("@/features/views/MemoriesView").then((m) => ({ default: m.MemoriesView })));
const WallView = lazy(() => import("@/features/views/WallView").then((m) => ({ default: m.WallView })));
const StickersView = lazy(() => import("@/features/views/StickersView").then((m) => ({ default: m.StickersView })));
const PetView = lazy(() => import("@/features/views/PetView").then((m) => ({ default: m.PetView })));
const PhotoBoothView = lazy(() =>
  import("@/features/photobooth/PhotoBoothView").then((m) => ({ default: m.PhotoBoothView })),
);
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
import { HeartBurstLayer } from "@/components/seanaya/HeartBurst";
import { ConfirmDialog } from "./ConfirmDialog";
import { MonthsaryWrapped } from "@/features/monthsary/MonthsaryWrapped";
import { bootTheme } from "@/lib/theme";
import { ART, Sparkle } from "@/components/seanaya/art";

const PETALS = [
  { left: "8%", size: 26, img: 1, dur: 26, delay: -4, sway: "80px", spin: "300deg", mobile: true },
  { left: "22%", size: 18, img: 2, dur: 31, delay: -19, sway: "-60px", spin: "-220deg", mobile: false },
  { left: "41%", size: 22, img: 3, dur: 28, delay: -11, sway: "70px", spin: "260deg", mobile: true },
  { left: "63%", size: 16, img: 1, dur: 34, delay: -26, sway: "-50px", spin: "200deg", mobile: false },
  { left: "78%", size: 24, img: 2, dur: 29, delay: -8, sway: "50px", spin: "-280deg", mobile: true },
  { left: "92%", size: 18, img: 3, dur: 33, delay: -16, sway: "-70px", spin: "240deg", mobile: false },
];

/** Fixed page scenery: clouds, a lily, drifting petals and a few sparkles. */
function SkyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden">
      <img
        src="/art/cloud-puff.webp"
        alt=""
        className="sn-cloud -left-24 top-[18%] w-[420px] opacity-60"
        style={{ ["--dur" as string]: "46s" }}
      />
      <img
        src="/art/cloud-puff.webp"
        alt=""
        className="sn-cloud -right-28 top-[48%] hidden w-[360px] opacity-50 md:block"
        style={{ ["--dur" as string]: "38s" }}
      />
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
      {PETALS.map((p, i) => (
        <img
          key={i}
          src={`/art/petal-${p.img}.png`}
          alt=""
          className={`sn-petal ${p.mobile ? "" : "hidden md:block"}`}
          style={{
            left: p.left,
            width: p.size,
            ["--dur" as string]: `${p.dur}s`,
            ["--delay" as string]: `${p.delay}s`,
            ["--sway" as string]: p.sway,
            ["--spin" as string]: p.spin,
          }}
        />
      ))}
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
    import.meta.env.DEV &&
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
        <div className="sn-hand animate-pulse text-[22px] text-[#646d93]">opening your space…</div>
      </div>
    );
  }

  if (!isUrlPreview && (isError || !effectiveRel)) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="flex max-w-sm flex-col items-center">
          <img src="/art/cat-peek.webp" alt="" className="h-[86px] w-auto select-none" draggable={false} />
          <div className="mt-4 font-serif text-[15px] font-medium tracking-[0.18em] text-[#38457c]">SEANAYA</div>
          <h2 className="mt-2 font-serif text-[28px] font-semibold leading-tight text-sn-navy">
            {isError ? "Couldn't reach your space" : "This phone was signed out"}
          </h2>
          <p className="mt-2 text-[15px] leading-snug text-sn-ink">
            {isError
              ? "Check your connection, then try again."
              : "Your PIN was used on another device. Enter it again here to come back in."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {isError ? (
              <button onClick={() => refetch()} className="sn-pill h-12 px-7 text-[15px]">
                Try again
              </button>
            ) : (
              <button onClick={() => window.location.reload()} className="sn-pill h-12 px-7 text-[15px]">
                Enter PIN again
              </button>
            )}
          </div>
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

      <div className="relative flex min-w-0 flex-1 flex-col">
        {tab !== "photobooth" && <AppHeader title={headerTitle} relationshipId={relId} />}

        <main className="flex-1">
          <MotionConfig reducedMotion="user">
          <Suspense fallback={<div className="h-[60vh]" />}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          >
          {tab === "home" && <HomeView relationshipId={relId} anniversary={effectiveRel?.anniversary ?? null} />}
          {tab === "calendar" && <CalendarView relationshipId={relId} />}
          {tab === "memories" && <MemoriesView relationshipId={relId} />}
          {tab === "wall" && <WallView relationshipId={relId} />}
          {tab === "stickers" && <StickersView relationshipId={relId} />}
          {tab === "pet" && <PetView relationshipId={relId} />}
          {tab === "photobooth" && <PhotoBoothView relationshipId={relId} />}
          </motion.div>
          </Suspense>
          </MotionConfig>
        </main>
      </div>
      </div>

      {tab !== "photobooth" && <BottomNav relationshipId={relId} />}

      <Sheet open={sheet === "add-memory"} title="New memory">
        <AddMemorySheet relationshipId={relId} />
      </Sheet>
      <Sheet open={sheet === "add-event"} title="New moment">
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
      <HeartBurstLayer />
      <ConfirmDialog />
      <MonthsaryWrapped relationshipId={relId} />
    </div>
  );
}
