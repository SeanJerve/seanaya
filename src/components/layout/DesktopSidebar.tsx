import { useState } from "react";
import {
  Home,
  Image as ImageIcon,
  Calendar,
  BookOpen,
  Star,
  Settings,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  type LucideIcon,
} from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { ART, LogoMark } from "@/components/seanaya/art";
import { toast } from "sonner";

type NavItem = {
  key: TabKey | "settings" | "milestones";
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "memories", label: "Memories", icon: ImageIcon },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "wall", label: "Journal", icon: BookOpen },
  { key: "milestones", label: "Milestones", icon: Star },
  { key: "settings", label: "Settings", icon: Settings },
];

const PLAYLIST = [
  { title: "Better Together", artist: "Seanaya FM" },
  { title: "Lover's Whisper", artist: "Bacolod & Beyond" },
  { title: "Daylight In Tokyo", artist: "Lo-Fi Romance" },
  { title: "Forever & Always", artist: "Aya & Sean" },
];

export function DesktopSidebar({ className = "" }: { className?: string }) {
  const { tab, setTab, openSheet, openMonthsary } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [songIndex, setSongIndex] = useState(0);
  const track = PLAYLIST[songIndex % PLAYLIST.length];

  const togglePlay = () => {
    setIsPlaying((prev) => {
      if (!prev) toast.success(`Playing "${track.title}" on Seanaya FM`);
      return !prev;
    });
  };
  const next = () => {
    const n = (songIndex + 1) % PLAYLIST.length;
    setSongIndex(n);
    toast.info(`Next track: ${PLAYLIST[n].title}`);
  };
  const prev = () => setSongIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length);

  const onNav = (key: NavItem["key"]) => {
    if (key === "settings") openSheet("settings");
    else if (key === "milestones") openMonthsary();
    else setTab(key);
  };

  return (
    <aside
      className={`sticky top-3.5 z-20 ml-3.5 mt-3.5 w-[202px] shrink-0 flex-col gap-3.5 self-start h-[calc(100dvh-28px)] max-h-[958px] ${className}`}
    >
      {/* Brand + navigation + cats */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/90 bg-[linear-gradient(180deg,rgba(238,238,253,0.86),rgba(232,236,251,0.8))] shadow-[var(--shadow-panel)] backdrop-blur-xl">
        <div className="flex flex-col items-center px-4 pt-5 text-center">
          <LogoMark className="h-10 w-14" />
          <div className="mt-2.5 font-serif text-[22px] font-medium leading-none tracking-[0.16em] text-[#38457c]">
            SEANAYA
          </div>
          <div className="mt-2 flex items-center gap-1 text-[12px] tracking-[0.05em] text-sn-muted">
            our little archive
          </div>
        </div>

        <nav className="mt-8 space-y-[2px] px-[18px]" aria-label="Primary">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = key === tab;
            return (
              <button
                key={key}
                onClick={() => onNav(key)}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 w-full items-center gap-3.5 rounded-full px-4 text-[14.5px] transition-colors ${
                  active
                    ? "border border-white/90 bg-[linear-gradient(180deg,#e5eafd,#d7dffb)] font-semibold text-sn-navy shadow-[var(--shadow-pill)]"
                    : "border border-transparent text-[#4a5687] hover:bg-white/45"
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.6}
                  className={active ? "text-[#4f63b0]" : "text-[#6f7fbd]"}
                />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="relative mt-auto min-h-[120px] flex-1 basis-0">
          <img
            src={ART.catsCloud}
            alt="Our two cats asleep on a cloud"
            draggable={false}
            className="absolute inset-x-0 bottom-0 h-full w-full select-none object-cover object-[50%_40%]"
          />
        </div>
      </div>

      {/* Mini player */}
      <div className="shrink-0 rounded-[24px] border border-white/90 bg-[linear-gradient(180deg,rgba(240,240,253,0.92),rgba(236,238,252,0.9))] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src={ART.albumSky}
            alt=""
            className="h-[64px] w-[56px] shrink-0 rounded-[10px] object-cover shadow-[0_6px_14px_-8px_rgba(70,84,150,0.6)]"
          />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-sn-navy">{track.title}</div>
            <div className="mt-0.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-sn-muted">
              {track.artist}
            </div>
          </div>
        </div>
        <div className="mt-4 h-[3px] rounded-full bg-[#dde2f6]">
          <div
            className="h-full rounded-full bg-[#9fb1ea] transition-[width] duration-700"
            style={{ width: isPlaying ? "46%" : "28%" }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between px-4">
          <button
            onClick={prev}
            aria-label="Previous track"
            className="grid h-9 w-9 place-items-center text-[#4a5687] hover:text-sn-navy"
          >
            <SkipBack size={16} className="fill-current" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="grid h-10 w-10 place-items-center rounded-full border border-white bg-[#f8f8fe] text-sn-navy shadow-[var(--shadow-pill)] active:scale-95"
          >
            {isPlaying ? (
              <Pause size={16} className="fill-current" />
            ) : (
              <Play size={16} className="ml-0.5 fill-current" />
            )}
          </button>
          <button
            onClick={next}
            aria-label="Next track"
            className="grid h-9 w-9 place-items-center text-[#4a5687] hover:text-sn-navy"
          >
            <SkipForward size={16} className="fill-current" />
          </button>
        </div>
      </div>
    </aside>
  );
}
