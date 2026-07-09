import { AnimatePresence, motion } from "framer-motion";
import { useDaypart, daypartGradient } from "@/hooks/useDaypart";
import { useRelationship } from "@/hooks/useRelationship";
import { usePanel } from "./store";
import { WorldScene } from "@/features/scene/WorldScene";
import { CalendarPanel } from "@/features/panels/CalendarPanel";
import { DashboardPanel } from "@/features/panels/DashboardPanel";
import { QuickDock } from "@/features/panels/QuickDock";
import { SidePanel } from "@/features/panels/SidePanel";
import { MemoryPanel } from "@/features/panels/MemoryPanel";
import { EventPanel } from "@/features/panels/EventPanel";
import { NotePanel } from "@/features/panels/NotePanel";
import { TripPanel } from "@/features/panels/TripPanel";
import { MusicPanel } from "@/features/panels/MusicPanel";
import { HugOverlay } from "@/features/panels/HugOverlay";
import { TopBar } from "@/features/panels/TopBar";

export function SeanayaApp() {
  const daypart = useDaypart();
  const { data: rel, isLoading } = useRelationship();
  const { openPanel, setPanel } = usePanel();

  if (isLoading || !rel) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--gradient-sky)" }}>
        <div className="text-muted-foreground text-sm">Warming the room…</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden transition-[background] duration-[2000ms]"
      style={{ background: daypartGradient[daypart] }}
    >
      {/* Fixed 16:9 canvas centered on screen */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[1600px] aspect-video grid grid-cols-[320px_1fr_340px] grid-rows-[auto_1fr_auto] gap-4">
          {/* Top bar spans full */}
          <div className="col-span-3">
            <TopBar relationshipId={rel.id} inviteCode={rel.invite_code ?? ""} />
          </div>

          {/* Left */}
          <div className="row-start-2">
            <CalendarPanel relationshipId={rel.id} />
          </div>

          {/* Center scene */}
          <div className="row-start-2 relative">
            <WorldScene daypart={daypart} relationshipId={rel.id} />
          </div>

          {/* Right */}
          <div className="row-start-2">
            <DashboardPanel relationshipId={rel.id} anniversary={rel.anniversary} />
          </div>

          {/* Dock */}
          <div className="col-span-3 row-start-3 flex justify-center">
            <QuickDock />
          </div>
        </div>
      </div>

      <HugOverlay relationshipId={rel.id} />

      <AnimatePresence>
        {openPanel && ["memory","event","note","trip","music","capsule","garden","pets","wall","vault"].includes(openPanel) && (
          <motion.div
            key={openPanel}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm"
            onClick={() => setPanel(null)}
          >
            <SidePanel onClose={() => setPanel(null)}>
              {openPanel === "memory" && <MemoryPanel relationshipId={rel.id} />}
              {openPanel === "event" && <EventPanel relationshipId={rel.id} />}
              {openPanel === "note" && <NotePanel relationshipId={rel.id} />}
              {openPanel === "trip" && <TripPanel relationshipId={rel.id} />}
              {openPanel === "music" && <MusicPanel relationshipId={rel.id} />}
              {openPanel === "capsule" && <Placeholder title="Time Capsules" copy="Write a letter your future selves will unlock." />}
              {openPanel === "garden" && <Placeholder title="Lily Garden" copy="Every memory grows a lily. Watch your garden fill in over time." />}
              {openPanel === "pets" && <Placeholder title="Little Pets" copy="Your cats live in the room. Add their names and birthdays to bring them to life." />}
              {openPanel === "wall" && <Placeholder title="Forever Wall" copy="Notes, promises, gratitude — pinned to a wall that never fades." />}
              {openPanel === "vault" && <MemoryPanel relationshipId={rel.id} />}
            </SidePanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Placeholder({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="p-8">
      <h2 className="display text-3xl mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm">{copy}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Coming soon to your Seanaya.
      </div>
    </div>
  );
}
