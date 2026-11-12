import { useState } from "react";
import {
  Home,
  Calendar,
  BookHeart,
  PenSquare,
  Camera,
  Settings,
  Cat,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
} from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { CuddlingCatsCloud } from "@/components/kawaii/KawaiiIllustrations";
import { toast } from "sonner";

const NAV_ITEMS: {
  key: TabKey | "settings";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "memories", label: "Memories", icon: BookHeart },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "wall", label: "Journal", icon: PenSquare },
  { key: "photobooth", label: "Photo Booth", icon: Camera },
  { key: "pet", label: "Pet Room", icon: Cat },
  { key: "settings", label: "Settings", icon: Settings },
];

export function DesktopSidebar({ className = "" }: { className?: string }) {
  const { tab, setTab, openSheet } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [songIndex, setSongIndex] = useState(0);

  const playlist = [
    { title: "Better Together", artist: "SEANAYA FM" },
    { title: "Lover's Whisper", artist: "Bacolod & Beyond" },
    { title: "Daylight In Tokyo", artist: "Lo-Fi Romance" },
    { title: "Forever & Always", artist: "Aya & Sean" },
  ];

  const currentTrack = playlist[songIndex % playlist.length];

  const togglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        toast.success(`Playing "${currentTrack.title}" on SEANAYA FM ♡`);
      }
      return next;
    });
  };

  const handleNextTrack = () => {
    setSongIndex((prev) => (prev + 1) % playlist.length);
    toast.info(`Next track: ${playlist[(songIndex + 1) % playlist.length].title}`);
  };

  const handlePrevTrack = () => {
    setSongIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  return (
    <aside
      className={`w-64 h-[calc(100vh-2rem)] sticky top-4 my-4 ml-4 rounded-3xl border border-white/80 bg-white/70 backdrop-blur-2xl p-5 flex flex-col justify-between shadow-[0_16px_40px_-8px_rgba(186,215,255,0.4),0_2px_12px_rgba(224,242,254,0.6)] z-20 ${className}`}
    >
      {/* ── Top App Brand ── */}
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center pt-2">
          {/* Handcrafted heart icon doodle */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-100 to-sky-100 border border-white flex items-center justify-center shadow-2xs mb-2">
            <Heart size={20} className="text-pink-400 fill-pink-300/40" />
          </div>
          <h2 className="font-serif text-lg tracking-[0.2em] font-bold text-[#233554] uppercase">
            Seanaya
          </h2>
          <span className="font-serif italic text-xs text-sky-800/70 tracking-wide mt-0.5">
            our little archive ♡
          </span>
        </div>

        {/* ── Navigation Links ── */}
        <nav className="space-y-1.5 pt-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === "settings" ? false : tab === item.key;
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                onClick={() => {
                  if (item.key === "settings") {
                    openSheet("settings");
                  } else {
                    setTab(item.key);
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-sky-200/70 to-pink-100/60 text-[#1e293b] font-semibold border border-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Icon
                  size={17}
                  className={isActive ? "text-pink-500" : "text-slate-400 group-hover:text-slate-600"}
                />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto text-pink-400 text-xs font-normal">♡</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Mid Section: Cuddling Kittens on a Cloud ── */}
      <div className="my-auto py-2 flex flex-col items-center">
        <CuddlingCatsCloud />
      </div>

      {/* ── Bottom Mini Music Player ── */}
      <div className="p-3 rounded-2xl bg-gradient-to-b from-sky-50/70 via-white/80 to-pink-50/50 border border-sky-100/90 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2.5">
          {/* Mini Album Cover Thumbnail */}
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-sky-300 via-indigo-200 to-pink-200 shrink-0 border border-white shadow-2xs flex items-center justify-center">
            {isPlaying ? (
              <div className="flex items-end justify-center gap-0.5 h-4 w-4">
                <span className="w-1 bg-white rounded-full h-3 animate-pulse" />
                <span className="w-1 bg-white rounded-full h-4 animate-bounce" />
                <span className="w-1 bg-white rounded-full h-2 animate-pulse" />
              </div>
            ) : (
              <Volume2 size={16} className="text-white/90" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-[#233554] truncate">
              {currentTrack.title}
            </h4>
            <p className="text-[10px] text-slate-500 font-light truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Audio Player Controls */}
        <div className="flex items-center justify-center gap-4 pt-0.5">
          <button
            onClick={handlePrevTrack}
            className="text-slate-400 hover:text-slate-700 active:scale-95 transition cursor-pointer"
            aria-label="Previous track"
          >
            <SkipBack size={14} />
          </button>

          <button
            onClick={togglePlay}
            className="w-7 h-7 rounded-full bg-pink-400 text-white flex items-center justify-center hover:bg-pink-500 active:scale-90 transition shadow-xs cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={12} className="fill-white" /> : <Play size={12} className="fill-white ml-0.5" />}
          </button>

          <button
            onClick={handleNextTrack}
            className="text-slate-400 hover:text-slate-700 active:scale-95 transition cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
