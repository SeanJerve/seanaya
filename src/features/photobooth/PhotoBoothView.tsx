import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  RotateCcw,
  Sparkles,
  Download,
  BookHeart,
  Wifi,
  WifiOff,
  SwitchCamera,
  Layers,
  Heart,
  ArrowLeft,
  Check,
  Upload,
  Trash2,
  Type,
} from "lucide-react";
import { useWebRTC } from "./useWebRTC";
import { usePhotoBoothSync } from "./usePhotoBoothSync";
import { FRAME_TEMPLATES, PHOTO_FILTERS, BOOTH_STICKERS } from "./frame-templates";
import {
  renderPhotoStripCanvas,
  downloadPhotoStrip,
  savePhotoStripToAlbum,
} from "./canvas-exporter";
import type { ShootStage, PlacedSticker, PhotoCut } from "./types";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import { getUserCity, getPartnerCity } from "@/lib/location-service";

function fireConfetti() {
  if (typeof document === "undefined") return;
  const container = document.createElement("div");
  container.className = "fixed inset-0 pointer-events-none z-50 overflow-hidden";
  document.body.appendChild(container);

  const colors = ["#f43f5e", "#ec4899", "#8b5cf6", "#38bdf8", "#fbbf24", "#34d399"];
  for (let i = 0; i < 42; i++) {
    const el = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    const startX = Math.random() * window.innerWidth;
    const endX = startX + (Math.random() - 0.5) * 240;
    const duration = 1.8 + Math.random() * 1.5;

    el.style.position = "absolute";
    el.style.left = `${startX}px`;
    el.style.top = "-20px";
    el.style.width = `${size}px`;
    el.style.height = `${size * 1.4}px`;
    el.style.backgroundColor = color;
    el.style.borderRadius = "2px";
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), top ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease`;

    container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.top = `${window.innerHeight + 30}px`;
      el.style.transform = `translate(${endX - startX}px, 0) rotate(${Math.random() * 720}deg)`;
      el.style.opacity = "0";
    });
  }

  setTimeout(() => {
    container.remove();
  }, 3500);
}

export function PhotoBoothView({ relationshipId }: { relationshipId: string }) {
  const { setTab } = useAppStore();
  const userName = pinStorage.getName() ?? "Sean";
  const userSlot = (pinStorage.getSlot() as "a" | "b") || "a";

  const [stage, setStage] = useState<ShootStage>("ready");
  const [isFlashing, setIsFlashing] = useState(false);
  const [activeCutNum, setActiveCutNum] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [customCaption, setCustomCaption] = useState("");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const stripContainerRef = useRef<HTMLDivElement | null>(null);

  // WebRTC Audio/Video Hook
  const {
    localStream,
    remoteStream,
    peerConnected,
    cameraError,
    isMirror,
    toggleFacingMode,
    toggleMirror,
    captureLocalFrame,
  } = useWebRTC({
    relationshipId,
    userSlot,
    enabled: true,
  });

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Sound effects generator (synthesized via Web Audio API, zero asset load)
  const playSound = (type: "beep" | "shutter" | "fanfare") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "beep") {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === "shutter") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  // Synced Photo Booth Realtime Hook
  const {
    partnerOnline,
    partnerName,
    selectedFrame,
    selectedFilter,
    countdownValue,
    cuts,
    stickers,
    broadcastFrame,
    broadcastFilter,
    startCountdown,
    broadcastCut,
    updateStickers,
    resetSession,
    setCuts,
  } = usePhotoBoothSync({
    relationshipId,
    userName,
    userSlot,
    onTriggerShutter: (cutIdx) => {
      // Trigger flash & sound
      setIsFlashing(true);
      playSound("shutter");
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 60, 20]);
      }
      setTimeout(() => setIsFlashing(false), 300);

      // Snap frame from video
      if (localVideoRef.current) {
        const dataUrl = captureLocalFrame(localVideoRef.current);
        if (dataUrl) {
          const newCut: PhotoCut = {
            id: `cut-${Date.now()}-${cutIdx}`,
            dataUrl,
            capturedBy: userSlot,
            timestamp: Date.now(),
          };
          broadcastCut(newCut);
        }
      }
    },
  });

  // Track countdown audio
  useEffect(() => {
    if (countdownValue && countdownValue > 0) {
      playSound("beep");
    }
  }, [countdownValue]);

  // Transition to review mode once 4 cuts are taken
  useEffect(() => {
    if (cuts.length >= 4 && stage !== "review") {
      setStage("review");
      fireConfetti();
      toast.success("Photos snapped! Time to decorate together.");
    }
  }, [cuts.length, stage]);

  const handleUploadCut = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newCut: PhotoCut = {
        id: `cut-upload-${Date.now()}`,
        dataUrl,
        capturedBy: userSlot,
        timestamp: Date.now(),
      };
      broadcastCut(newCut);
      toast.success("Photo added to booth!");
    };
    reader.readAsDataURL(file);
  };

  // Sequence controller: snaps 4 photos with 3s intervals
  const handleStartSession = () => {
    resetSession();
    setActiveCutNum(1);
    startCountdown(0);

    // Auto queue cuts 2, 3, and 4
    setTimeout(() => {
      setActiveCutNum(2);
      startCountdown(1);
    }, 4500);

    setTimeout(() => {
      setActiveCutNum(3);
      startCountdown(2);
    }, 9000);

    setTimeout(() => {
      setActiveCutNum(4);
      startCountdown(3);
    }, 13500);
  };

  // Sticker placer
  const handleAddSticker = (stickerSrc: string) => {
    const newSticker: PlacedSticker = {
      id: `sticker-${Date.now()}`,
      src: stickerSrc,
      xPercent: 30 + Math.random() * 40,
      yPercent: 20 + Math.random() * 60,
      scale: 1,
      rotation: Math.round((Math.random() - 0.5) * 30),
      placedBy: userName,
    };
    updateStickers((prev) => [...prev, newSticker]);
  };

  // Export handlers
  const handleDownload = async () => {
    try {
      const canvas = await renderPhotoStripCanvas({
        cuts,
        frameId: selectedFrame,
        filterId: selectedFilter,
        stickers,
        partnerName,
        userName,
        customCaption,
        userCity: getUserCity(),
        partnerCity: getPartnerCity(),
      });
      downloadPhotoStrip(canvas, `Seanaya_Photobooth_${Date.now()}.png`);
      fireConfetti();
      toast.success("Photo strip downloaded to your device!");
    } catch (err: any) {
      toast.error(err.message || "Failed to export strip");
    }
  };

  const handleSaveToAlbum = async () => {
    setIsSaving(true);
    try {
      const canvas = await renderPhotoStripCanvas({
        cuts,
        frameId: selectedFrame,
        filterId: selectedFilter,
        stickers,
        partnerName,
        userName,
        customCaption,
        userCity: getUserCity(),
        partnerCity: getPartnerCity(),
      });
      await savePhotoStripToAlbum({
        canvas,
        relationshipId,
        title: customCaption ? customCaption : `LDR Photo Booth with ${partnerName}`,
      });
      fireConfetti();
      toast.success("Saved to your Seanaya Album!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save to album");
    } finally {
      setIsSaving(false);
    }
  };

  const activeFrameConfig =
    FRAME_TEMPLATES.find((f) => f.id === selectedFrame) || FRAME_TEMPLATES[0];

  return (
    <div className="relative min-h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Full-Screen Camera Flash Overlay */}
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="w-full max-w-md px-4 pt-3 flex items-center justify-between z-20">
        <button
          onClick={() => setTab("home")}
          className="touch-target p-2 rounded-full bg-white/10 hover:bg-white/20 transition active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex flex-col items-center">
          <span className="font-serif text-lg tracking-tight font-medium text-white/90">
            Seanaya Booth
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-white/60">
            {partnerOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{partnerName} connected</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Waiting for {partnerName}…</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleMirror}
            title="Mirror Camera"
            className="touch-target p-2 rounded-full bg-white/10 hover:bg-white/20 transition active:scale-95 text-xs"
          >
            {isMirror ? "Mirror" : "Normal"}
          </button>
          <button
            onClick={toggleFacingMode}
            title="Switch Camera"
            className="touch-target p-2 rounded-full bg-white/10 hover:bg-white/20 transition active:scale-95"
          >
            <SwitchCamera size={18} />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="w-full max-w-md grow flex flex-col items-center justify-center p-3 relative">
        {stage !== "review" ? (
          /* Live Dual-Camera Viewfinder */
          <div className="w-full flex flex-col gap-3 relative">
            {/* Viewfinder Frame Container */}
            <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex flex-col">
              {/* Top View: Sean / Local User */}
              <div className="relative w-full h-1/2 overflow-hidden border-b border-white/10 bg-black/40">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isMirror ? "scale-x-[-1]" : ""}`}
                />
                <div className="absolute top-2.5 left-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[12px] text-white/80 border border-white/10 font-medium">
                  {userName} ({getUserCity()})
                </div>
              </div>

              {/* Bottom View: Partner / Remote Video */}
              <div className="relative w-full h-1/2 overflow-hidden bg-black/40 flex items-center justify-center">
                {peerConnected && remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-white/50">
                    <WifiOff size={24} className="mb-2 opacity-60" />
                    <p className="text-xs font-medium">Live Partner Camera</p>
                    <p className="text-[12px] text-white/40 mt-0.5">
                      {partnerOnline
                        ? "Syncing video connection…"
                        : "She can join via her device anytime!"}
                    </p>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[12px] text-white/80 border border-white/10 font-medium">
                  {partnerName} (Remote)
                </div>
              </div>

              {/* Countdown Number Pop-up */}
              <AnimatePresence>
                {countdownValue !== null && countdownValue > 0 && (
                  <motion.div
                    key={countdownValue}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 1.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 450, damping: 25 }}
                    className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex flex-col items-center justify-center z-40"
                  >
                    <span className="font-serif text-5xl font-bold text-white tabular-nums">
                      {countdownValue}
                    </span>
                    <span className="text-[12px] text-white/70 uppercase tracking-widest mt-1">
                      Cut {activeCutNum}/4
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Shoot Controls */}
            <div className="w-full flex items-center justify-center gap-3 pt-2">
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleStartSession}
                className="btn-press flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-slate-900 font-semibold shadow-lg hover:bg-white/90 active:scale-95 transition"
              >
                <Camera size={18} className="text-pink-500" />
                <span>Start 4-Cut Shoot</span>
              </motion.button>

              <label className="btn-press flex items-center gap-1.5 px-4 py-3.5 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 active:scale-95 transition cursor-pointer border border-white/15">
                <Upload size={16} />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleUploadCut}
                />
              </label>
            </div>
          </div>
        ) : (
          /* Review & Co-Decorate Mode */
          <div className="w-full flex flex-col items-center gap-4">
            {/* The Photo Strip Preview Container */}
            <div
              ref={stripContainerRef}
              className="relative w-64 rounded-2xl p-3 shadow-2xl transition-colors duration-300 select-none"
              style={{
                backgroundColor: activeFrameConfig.bgColor,
                color: activeFrameConfig.textColor,
              }}
            >
              {/* 4 Cuts Preview */}
              <div className="flex flex-col gap-2">
                {cuts.slice(0, 4).map((cut, idx) => (
                  <div
                    key={cut.id}
                    className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black/10 relative shadow-sm"
                  >
                    <img
                      src={cut.dataUrl}
                      alt={`Cut ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        filter: PHOTO_FILTERS.find((f) => f.id === selectedFilter)?.cssFilter,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Strip Footer */}
              <div className="pt-3 pb-1 text-center flex flex-col items-center">
                <span className="font-serif text-sm font-semibold tracking-tight">Seanaya</span>
                <span className="text-[11px] opacity-70">
                  {customCaption.trim()
                    ? customCaption.trim()
                    : activeFrameConfig.hasLdrTag
                      ? `${getUserCity()} — ${getPartnerCity()} • ${new Date().toLocaleDateString()}`
                      : `${userName} & ${partnerName} • ${new Date().toLocaleDateString()}`}
                </span>
              </div>

              {/* Render Placed Draggable Stickers */}
              {stickers.map((stk) => (
                <motion.div
                  key={stk.id}
                  drag
                  dragConstraints={stripContainerRef}
                  dragMomentum={false}
                  onDragEnd={(_e, info) => {
                    if (!stripContainerRef.current) return;
                    const rect = stripContainerRef.current.getBoundingClientRect();
                    const newX = Math.max(
                      5,
                      Math.min(95, ((info.point.x - rect.left) / rect.width) * 100),
                    );
                    const newY = Math.max(
                      5,
                      Math.min(95, ((info.point.y - rect.top) / rect.height) * 100),
                    );
                    updateStickers((prev) =>
                      prev.map((s) =>
                        s.id === stk.id ? { ...s, xPercent: newX, yPercent: newY } : s,
                      ),
                    );
                  }}
                  onClick={() => setSelectedStickerId(selectedStickerId === stk.id ? null : stk.id)}
                  style={{
                    position: "absolute",
                    left: `${stk.xPercent}%`,
                    top: `${stk.yPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(${stk.scale})`,
                    cursor: "grab",
                  }}
                  whileDrag={{ scale: 1.15, cursor: "grabbing" }}
                  className="z-30 select-none group"
                >
                  <img
                    src={stk.src}
                    alt="sticker"
                    className="w-10 h-10 object-contain drop-shadow pointer-events-none"
                  />
                  {selectedStickerId === stk.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStickers((prev) => prev.filter((s) => s.id !== stk.id));
                        setSelectedStickerId(null);
                      }}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white shadow hover:scale-110 active:scale-95 transition"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Customization Toolbar: Caption, Frames & Filters */}
            <div className="w-full max-w-sm flex flex-col gap-2.5 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              {/* Custom Caption Input */}
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                <Type size={14} className="text-white/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Custom caption (e.g. Our 3rd Monthsary)"
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder:text-white/40 outline-none w-full"
                />
              </div>

              {/* Frame Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {FRAME_TEMPLATES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => broadcastFrame(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                      selectedFrame === f.id
                        ? "bg-white text-slate-900 shadow"
                        : "bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              {/* Filter Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {PHOTO_FILTERS.map((flt) => (
                  <button
                    key={flt.id}
                    onClick={() => broadcastFilter(flt.id as any)}
                    className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition ${
                      selectedFilter === flt.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {flt.name}
                  </button>
                ))}
              </div>

              {/* Sticker Stamp Pad */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1 no-scrollbar border-t border-white/10">
                <span className="text-[12px] text-white/40 uppercase tracking-wider shrink-0">
                  Stickers:
                </span>
                {BOOTH_STICKERS.map((stk) => (
                  <button
                    key={stk.id}
                    onClick={() => handleAddSticker(stk.src)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-90 transition shrink-0"
                    title={stk.label}
                  >
                    <img src={stk.src} alt={stk.label} className="w-6 h-6 object-contain" />
                  </button>
                ))}
              </div>
            </div>

            {/* Actions: Download, Save to Album, Retake */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDownload}
                className="btn-press flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-slate-900 text-xs font-medium shadow hover:bg-white/90"
              >
                <Download size={14} />
                <span>Download Strip</span>
              </button>

              <button
                onClick={handleSaveToAlbum}
                disabled={isSaving}
                className="btn-press flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow hover:opacity-90 disabled:opacity-50"
              >
                <BookHeart size={14} />
                <span>{isSaving ? "Saving…" : "Save to Album"}</span>
              </button>

              <button
                onClick={() => setStage("ready")}
                className="touch-target p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition"
                title="Retake Photos"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
