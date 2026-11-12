import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  RotateCcw,
  Download,
  SwitchCamera,
  ArrowLeft,
  Upload,
  Trash2,
  FlipHorizontal2,
  Check,
  BookImage,
} from "lucide-react";
import { useWebRTC } from "./useWebRTC";
import { usePhotoBoothSync } from "./usePhotoBoothSync";
import { FRAME_TEMPLATES, PHOTO_FILTERS, BOOTH_STICKERS } from "./frame-templates";
import {
  renderPhotoStripCanvas,
  downloadPhotoStrip,
  saveStripToAlbumBook,
  updateSavedStrip,
  type SavedStrip,
} from "./canvas-exporter";
import type { ShootStage, PlacedSticker, PhotoCut } from "./types";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import { getUserCity, getPartnerCity } from "@/lib/location-service";
import { useCoupleNames } from "@/hooks/useCouple";
import { ART, chibiFor } from "@/components/seanaya/art";

function fireConfetti() {
  if (typeof document === "undefined") return;
  const container = document.createElement("div");
  container.className = "fixed inset-0 pointer-events-none z-50 overflow-hidden";
  document.body.appendChild(container);
  const colors = ["#f9c3d9", "#b2c8fa", "#ffffff", "#e9d9fb", "#fde4ee"];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement("div");
    const size = 6 + Math.random() * 7;
    const startX = Math.random() * window.innerWidth;
    const endX = startX + (Math.random() - 0.5) * 220;
    const duration = 1.8 + Math.random() * 1.4;
    Object.assign(el.style, {
      position: "absolute",
      left: `${startX}px`,
      top: "-20px",
      width: `${size}px`,
      height: `${size * 1.3}px`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      borderRadius: "3px",
      transform: `rotate(${Math.random() * 360}deg)`,
      transition: `transform ${duration}s cubic-bezier(0.25,1,0.5,1), top ${duration}s cubic-bezier(0.25,1,0.5,1), opacity ${duration}s ease`,
    });
    container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${window.innerHeight + 30}px`;
      el.style.transform = `translate(${endX - startX}px, 0) rotate(${Math.random() * 720}deg)`;
      el.style.opacity = "0";
    });
  }
  setTimeout(() => container.remove(), 3400);
}

export function PhotoBoothView({ relationshipId }: { relationshipId: string }) {
  const { setTab } = useAppStore();
  const { me: userName, partner } = useCoupleNames();
  const userSlot = (pinStorage.getSlot() as "a" | "b") || "a";

  const [stage, setStage] = useState<ShootStage>("ready");
  const [isFlashing, setIsFlashing] = useState(false);
  const [activeCutNum, setActiveCutNum] = useState(0);
  const [customCaption, setCustomCaption] = useState("");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Album auto-save
  const startedHere = useRef(false);
  const [saved, setSaved] = useState<SavedStrip | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const stripContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    localStream,
    remoteStream,
    peerConnected,
    cameraError,
    isMirror,
    toggleFacingMode,
    toggleMirror,
    captureLocalFrame,
  } = useWebRTC({ relationshipId, userSlot, enabled: true });

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Synthesised shutter and countdown sounds
  const playSound = (type: "beep" | "shutter") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "beep") {
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      /* no audio */
    }
  };

  const {
    partnerOnline,
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
  } = usePhotoBoothSync({
    relationshipId,
    userName,
    userSlot,
    onTriggerShutter: (cutIdx) => {
      setIsFlashing(true);
      playSound("shutter");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([15, 60, 20]);
      setTimeout(() => setIsFlashing(false), 300);
      if (localVideoRef.current) {
        const dataUrl = captureLocalFrame(localVideoRef.current);
        if (dataUrl) {
          broadcastCut({
            id: `cut-${Date.now()}-${cutIdx}`,
            dataUrl,
            capturedBy: userSlot,
            timestamp: Date.now(),
          } as PhotoCut);
        }
      }
    },
  });

  useEffect(() => {
    if (countdownValue && countdownValue > 0) playSound("beep");
  }, [countdownValue]);

  const renderStrip = () =>
    renderPhotoStripCanvas({
      cuts,
      frameId: selectedFrame,
      filterId: selectedFilter,
      stickers,
      partnerName: partner,
      userName,
      customCaption,
      userCity: getUserCity(),
      partnerCity: getPartnerCity(),
    });

  const albumTitle = () =>
    customCaption.trim() || `Photo booth with ${partner}`;

  // Four frames in → review, and the device that started the shoot files it in the album.
  useEffect(() => {
    if (cuts.length >= 4 && stage !== "review") {
      setStage("review");
      fireConfetti();
      if (startedHere.current && relationshipId) {
        startedHere.current = false;
        setSaveState("saving");
        renderStrip()
          .then((canvas) => saveStripToAlbumBook({ canvas, relationshipId, title: albumTitle() }))
          .then((s) => {
            setSaved(s);
            setSaveState("saved");
            setDirty(false);
            toast.success("Strip saved to your album");
          })
          .catch((err) => {
            setSaveState("error");
            toast.error(err?.message || "Couldn't save to the album");
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuts.length, stage]);

  // Any decoration after saving means the album copy is out of date.
  useEffect(() => {
    if (saved) setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrame, selectedFilter, stickers, customCaption]);

  const handleUploadCut = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startedHere.current = true;
    const reader = new FileReader();
    reader.onload = () => {
      broadcastCut({
        id: `cut-upload-${Date.now()}`,
        dataUrl: reader.result as string,
        capturedBy: userSlot,
        timestamp: Date.now(),
      } as PhotoCut);
      toast.success(`Photo ${Math.min(cuts.length + 1, 4)} of 4 added`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleStartSession = () => {
    resetSession();
    setSaved(null);
    setSaveState("idle");
    setDirty(false);
    startedHere.current = true;
    setActiveCutNum(1);
    startCountdown(0);
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

  const handleAddSticker = (src: string) => {
    const s: PlacedSticker = {
      id: `sticker-${Date.now()}`,
      src,
      xPercent: 30 + Math.random() * 40,
      yPercent: 20 + Math.random() * 60,
      scale: 1,
      rotation: Math.round((Math.random() - 0.5) * 30),
      placedBy: userName,
    };
    updateStickers((prev) => [...prev, s]);
  };

  const handleDownload = async () => {
    try {
      downloadPhotoStrip(await renderStrip(), `Seanaya_Photobooth_${Date.now()}.png`);
    } catch (err: any) {
      toast.error(err.message || "Couldn't export the strip");
    }
  };

  const handleSaveOrUpdate = async () => {
    setSaveState("saving");
    try {
      const canvas = await renderStrip();
      const s = saved
        ? await updateSavedStrip(saved, canvas, relationshipId)
        : await saveStripToAlbumBook({ canvas, relationshipId, title: albumTitle() });
      setSaved(s);
      setDirty(false);
      setSaveState("saved");
      toast.success(saved ? "Album copy updated" : "Strip saved to your album");
    } catch (err: any) {
      setSaveState("error");
      toast.error(err.message || "Couldn't save to the album");
    }
  };

  const frame = FRAME_TEMPLATES.find((f) => f.id === selectedFrame) || FRAME_TEMPLATES[0];
  const filterCss = PHOTO_FILTERS.find((f) => f.id === selectedFilter)?.cssFilter;
  const shooting = countdownValue !== null && countdownValue > 0;

  const chip = (active: boolean) =>
    `h-9 shrink-0 rounded-full px-4 text-[13.5px] transition ${
      active ? "sn-pill" : "bg-white/70 text-sn-ink hover:bg-white"
    }`;

  return (
    <div className="relative min-h-[100dvh] w-full pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed inset-0 z-50 bg-white"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            onClick={() => setTab("home")}
            aria-label="Back to home"
            className="sn-pill sn-icon-btn h-11 w-11"
          >
            <ArrowLeft size={19} strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="font-serif text-[26px] font-semibold leading-tight text-sn-navy sm:text-[32px]">
              Photo booth
            </h1>
            <p className="flex items-center gap-2 text-[14px] text-sn-ink">
              <span
                className={`h-2.5 w-2.5 rounded-full ${partnerOnline ? "bg-sn-mint" : "bg-[#f2c27b]"}`}
              />
              {partnerOnline ? `${partner} is here` : `Waiting for ${partner}`}
            </p>
          </div>
        </div>
        {stage !== "review" && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMirror}
              aria-pressed={isMirror}
              aria-label={isMirror ? "Mirroring on" : "Mirroring off"}
              title={isMirror ? "Mirroring on" : "Mirroring off"}
              className={`sn-icon-btn h-11 w-11 ${isMirror ? "sn-pill" : "sn-ghost"}`}
            >
              <FlipHorizontal2 size={18} strokeWidth={1.9} />
            </button>
            <button
              onClick={toggleFacingMode}
              aria-label="Switch camera"
              title="Switch camera"
              className="sn-pill sn-icon-btn h-11 w-11"
            >
              <SwitchCamera size={18} strokeWidth={1.9} />
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto mt-5 grid w-full max-w-[1100px] gap-5 px-4 sm:px-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {stage !== "review" ? (
          <>
            {/* Two cameras, framed like a strip */}
            <div className="sn-card mx-auto w-full max-w-[560px] p-3 sm:p-4">
              <div className="relative overflow-hidden rounded-[20px]">
                <div className="grid aspect-[3/4] grid-rows-2 gap-2 sm:aspect-[4/5]">
                  <div className="relative overflow-hidden rounded-[16px] bg-[#dfe6fb]">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`h-full w-full object-cover ${isMirror ? "scale-x-[-1]" : ""}`}
                    />
                    {(cameraError || !localStream) && (
                      <div className="absolute inset-0 grid place-items-center p-6 text-center">
                        <p className="max-w-[260px] text-[14.5px] leading-relaxed text-sn-ink">
                          {cameraError
                            ? "Camera access is off. Allow it in your browser to shoot together."
                            : "Starting your camera…"}
                        </p>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-[13px] font-semibold text-sn-navy shadow-[var(--shadow-pill)]">
                      {userName} · {getUserCity()}
                    </span>
                  </div>
                  <div className="relative overflow-hidden rounded-[16px] bg-[#ebe7f8]">
                    {peerConnected && remoteStream ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                        <img
                          src={chibiFor(partner)}
                          alt=""
                          className="h-20 w-[72px] rounded-[18px] border-[3px] border-white object-cover shadow-[var(--shadow-pill)]"
                        />
                        <p className="max-w-[260px] text-[14.5px] leading-relaxed text-sn-ink">
                          {partnerOnline
                            ? `Connecting to ${partner}'s camera…`
                            : `${partner}'s camera appears here when they open the booth.`}
                        </p>
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 text-[13px] font-semibold text-sn-navy shadow-[var(--shadow-pill)]">
                      {partner} · {getPartnerCity()}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {shooting && (
                    <motion.div
                      key={countdownValue}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 26 }}
                      className="absolute inset-0 m-auto flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white bg-white/90 shadow-[var(--shadow-panel)]"
                    >
                      <span className="font-serif text-[52px] font-bold leading-none text-sn-navy tabular-nums">
                        {countdownValue}
                      </span>
                      <span className="mt-1 text-[12.5px] font-semibold text-sn-muted">
                        Frame {activeCutNum} of 4
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Controls */}
            <aside className="sn-card sn-card-lavender mx-auto w-full max-w-[560px] p-6">
              <h2 className="font-serif text-[22px] font-semibold text-sn-navy">Four frames, together</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-sn-ink">
                Press start and both cameras count down from three, four times over. The finished
                strip goes straight into your album.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleStartSession}
                  disabled={shooting}
                  className="sn-pill h-12 flex-1 px-5 text-[15.5px]"
                >
                  <Camera size={19} strokeWidth={1.9} />
                  {shooting ? `Frame ${activeCutNum} of 4` : "Start shoot"}
                </button>
                <label className="sn-ghost h-12 cursor-pointer px-5 text-[15px]">
                  <Upload size={17} strokeWidth={1.9} />
                  Upload
                  <input type="file" accept="image/*" className="sr-only" onChange={handleUploadCut} />
                </label>
              </div>
              {cuts.length > 0 && cuts.length < 4 && (
                <div className="mt-5 flex gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] flex-1 overflow-hidden rounded-[10px] border-2 border-white bg-white/60"
                    >
                      {cuts[i] && <img src={cuts[i].dataUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </>
        ) : (
          <>
            {/* Strip preview */}
            <div className="flex justify-center lg:justify-end lg:pr-6">
              <div
                ref={stripContainerRef}
                className="relative w-[260px] select-none rounded-[14px] p-3 shadow-[0_30px_60px_-30px_rgba(50,70,150,0.7)] transition-colors duration-300"
                style={{ backgroundColor: frame.bgColor, color: frame.textColor }}
              >
                <div className="flex flex-col gap-2">
                  {cuts.slice(0, 4).map((cut, idx) => (
                    <div key={cut.id} className="relative aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-black/10">
                      <img
                        src={cut.dataUrl}
                        alt={`Frame ${idx + 1}`}
                        className="pointer-events-none h-full w-full object-cover"
                        style={{ filter: filterCss }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-center pb-1 pt-3 text-center">
                  <span className="font-serif text-[15px] font-semibold">Seanaya</span>
                  <span className="text-[12px] opacity-75">
                    {customCaption.trim()
                      ? customCaption.trim()
                      : frame.hasLdrTag
                        ? `${getUserCity()} — ${getPartnerCity()} · ${new Date().toLocaleDateString()}`
                        : `${userName} & ${partner} · ${new Date().toLocaleDateString()}`}
                  </span>
                </div>

                {stickers.map((stk) => (
                  <motion.div
                    key={stk.id}
                    drag
                    dragConstraints={stripContainerRef}
                    dragMomentum={false}
                    onDragEnd={(_e, info) => {
                      if (!stripContainerRef.current) return;
                      const r = stripContainerRef.current.getBoundingClientRect();
                      const x = Math.max(5, Math.min(95, ((info.point.x - r.left) / r.width) * 100));
                      const y = Math.max(5, Math.min(95, ((info.point.y - r.top) / r.height) * 100));
                      updateStickers((prev) =>
                        prev.map((s) => (s.id === stk.id ? { ...s, xPercent: x, yPercent: y } : s)),
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
                    className="z-30 select-none"
                  >
                    <img src={stk.src} alt="" className="pointer-events-none h-11 w-11 object-contain drop-shadow" />
                    {selectedStickerId === stk.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStickers((prev) => prev.filter((s) => s.id !== stk.id));
                          setSelectedStickerId(null);
                        }}
                        aria-label="Remove sticker"
                        className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-[#d24f7a] text-white shadow"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Decorate + save */}
            <aside className="sn-card flex flex-col gap-5 p-6">
              <div>
                <h2 className="font-serif text-[22px] font-semibold text-sn-navy">Make it yours</h2>
                <p className="mt-1 flex items-center gap-2 text-[14px] text-sn-ink">
                  {saveState === "saving" && "Saving to your album…"}
                  {saveState === "saved" && !dirty && (
                    <>
                      <Check size={16} strokeWidth={2.2} className="text-[#3a9c7a]" /> In your album
                    </>
                  )}
                  {saveState === "saved" && dirty && "You've changed it since it was saved."}
                  {saveState === "error" && "Not saved yet."}
                  {saveState === "idle" && `${partner} saves this strip on their side.`}
                </p>
              </div>

              <input
                type="text"
                placeholder="Caption, like “Our 5th monthsary”"
                value={customCaption}
                onChange={(e) => setCustomCaption(e.target.value)}
                className="h-11 w-full rounded-full border border-[#e1e4f5] bg-white/85 px-4 text-[15px] text-sn-navy outline-none placeholder:text-sn-faint focus:border-sn-periwinkle"
              />

              <div>
                <h3 className="sn-label">Frame</h3>
                <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
                  {FRAME_TEMPLATES.map((f) => (
                    <button key={f.id} onClick={() => broadcastFrame(f.id)} className={chip(selectedFrame === f.id)}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="sn-label">Filter</h3>
                <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
                  {PHOTO_FILTERS.map((flt) => (
                    <button
                      key={flt.id}
                      onClick={() => broadcastFilter(flt.id as any)}
                      className={chip(selectedFilter === flt.id)}
                    >
                      {flt.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="sn-label">Stickers</h3>
                <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
                  {BOOTH_STICKERS.map((stk) => (
                    <button
                      key={stk.id}
                      onClick={() => handleAddSticker(stk.src)}
                      title={stk.label}
                      aria-label={`Add ${stk.label}`}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-white bg-white/70 transition hover:bg-white active:scale-95"
                    >
                      <img src={stk.src} alt="" className="h-8 w-8 object-contain" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 border-t border-[#ebe8f6] pt-5">
                {(saveState !== "saved" || dirty) && (
                  <button
                    onClick={handleSaveOrUpdate}
                    disabled={saveState === "saving"}
                    className="sn-pill h-11 flex-1 px-5 text-[14.5px]"
                  >
                    <BookImage size={17} strokeWidth={1.9} />
                    {saved ? "Update album copy" : "Save to album"}
                  </button>
                )}
                <button onClick={handleDownload} className="sn-ghost h-11 px-5 text-[14.5px]">
                  <Download size={17} strokeWidth={1.9} />
                  Download
                </button>
                <button
                  onClick={() => {
                    resetSession();
                    setStage("ready");
                  }}
                  className="sn-ghost h-11 px-5 text-[14.5px]"
                >
                  <RotateCcw size={16} strokeWidth={1.9} />
                  Retake
                </button>
              </div>
            </aside>
          </>
        )}
      </main>

      <img
        src={ART.lilyStem}
        alt=""
        aria-hidden
        className="pointer-events-none fixed -bottom-10 -right-10 hidden w-[200px] -rotate-[20deg] select-none opacity-90 xl:block"
      />
    </div>
  );
}
