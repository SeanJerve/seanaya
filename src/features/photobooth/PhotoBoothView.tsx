import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Check, Download, FlipHorizontal2, RotateCcw, SwitchCamera, BookImage, Camera } from "lucide-react";
import { useWebRTC } from "./useWebRTC";
import { useBoothSession } from "./useBoothSession";
import { FILTERS, LAYOUTS, STYLES, downloadCanvas, renderBooth, type LayoutId, type StyleId } from "./booth-templates";
import { saveStripToAlbumBook, updateSavedStrip, type SavedStrip } from "./album-save";
import { pinStorage } from "@/features/pin/pin-utils";
import { useAppStore } from "@/features/app/store";
import { useCoupleNames } from "@/hooks/useCouple";
import { chibiFor } from "@/components/seanaya/art";

export function PhotoBoothView({ relationshipId }: { relationshipId: string }) {
  const { setTab } = useAppStore();
  const { me, partner } = useCoupleNames();
  const slot = ((pinStorage.getSlot() as "a" | "b") || "a") as "a" | "b";
  const names = slot === "a" ? `${me} & ${partner}` : `${partner} & ${me}`;

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [flash, setFlash] = useState(false);

  const cam = useWebRTC({ relationshipId, userSlot: slot, enabled: true });
  useEffect(() => {
    if (localVideoRef.current && cam.localStream) localVideoRef.current.srcObject = cam.localStream;
  }, [cam.localStream]);
  useEffect(() => {
    if (remoteVideoRef.current && cam.remoteStream) remoteVideoRef.current.srcObject = cam.remoteStream;
  }, [cam.remoteStream, cam.peerConnected]);

  const session = useBoothSession({
    relationshipId,
    slot,
    name: me,
    capture: () => (localVideoRef.current ? cam.captureLocalFrame(localVideoRef.current) || null : null),
    onShotTaken: () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 280);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    },
  });

  // Live render of the strip as frames come in
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderBooth({
      layout: session.layout,
      style: session.style,
      filterId: session.filterId,
      shots: session.shots,
      caption: session.caption,
      names,
    }).then((c) => alive && setPreview(c.toDataURL("image/png")));
    return () => {
      alive = false;
    };
  }, [session.layout, session.style, session.filterId, session.shots, session.caption, names]);

  // Auto-save the finished result once (A saves when you shoot together, otherwise whoever shot it)
  const [saved, setSaved] = useState<SavedStrip | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedLook = useRef("");
  const look = `${session.layout}|${session.style}|${session.filterId}|${session.caption}`;
  const leader = session.partnerHere ? slot === "a" : true;
  const render = () =>
    renderBooth({
      layout: session.layout,
      style: session.style,
      filterId: session.filterId,
      shots: session.shots,
      caption: session.caption,
      names,
    });

  useEffect(() => {
    if (!session.done || saved || saveState === "saving" || !leader || !relationshipId) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const s = await saveStripToAlbumBook({
          canvas: await render(),
          relationshipId,
          title: session.caption.trim() || `Photo booth with ${partner}`,
        });
        savedLook.current = look;
        setSaved(s);
        setSaveState("saved");
        toast.success("Saved to your album");
      } catch (e: any) {
        setSaveState("error");
        toast.error("Couldn't save to the album. Check your connection and try again.");
      }
    }, 1500); // let the partner's last frame arrive
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.done]);

  const updateAlbum = async () => {
    setSaveState("saving");
    try {
      const canvas = await render();
      const s = saved
        ? await updateSavedStrip(saved, canvas, relationshipId)
        : await saveStripToAlbumBook({ canvas, relationshipId, title: session.caption.trim() || `Photo booth with ${partner}` });
      savedLook.current = look;
      setSaved(s);
      setSaveState("saved");
      toast.success(saved ? "Album copy updated" : "Saved to your album");
    } catch (e: any) {
      setSaveState("error");
      toast.error("Couldn't save to the album. Check your connection and try again.");
    }
  };

  const shootAgain = () => {
    session.reset();
    setSaved(null);
    setSaveState("idle");
  };

  const partnerLive = cam.peerConnected && !!cam.remoteStream;
  const counting = session.countdown !== null;
  const chip = (on: boolean) => `sn-pill h-9 shrink-0 px-4 text-[13.5px] ${on ? "sn-active" : ""}`;

  let readyLabel = "Ready";
  if (counting) readyLabel = "Smile";
  else if (session.meReady && session.partnerHere && !session.partnerReady) readyLabel = `Waiting for ${partner}`;
  else if (!session.meReady && session.partnerReady) readyLabel = `${partner} is ready`;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="pointer-events-none fixed inset-0 z-50 bg-white"
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setTab("home")} aria-label="Back to home" className="sn-pill sn-icon-btn h-11 w-11">
            <ArrowLeft size={19} strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="font-serif text-[24px] font-semibold leading-tight text-sn-navy sm:text-[28px]">Photo booth</h1>
            <p className="flex items-center gap-2 text-[13.5px] text-sn-ink">
              <span className={`h-2 w-2 rounded-full ${session.partnerHere ? "bg-sn-mint" : "bg-[#c6cbe3]"}`} />
              {session.partnerHere ? `${partner} is here` : `${partner} isn't in the booth`}
            </p>
          </div>
        </div>
        {!session.done && (
          <span className="font-serif text-[18px] font-semibold text-sn-navy tabular-nums">
            {Math.min(session.shotIndex + 1, session.total)} / {session.total}
          </span>
        )}
      </header>

      {!session.done ? (
        <>
          {/* Stage: two cameras + the strip as it fills */}
          <main className="absolute inset-x-0 bottom-[178px] top-[84px] flex items-stretch justify-center gap-5 px-4 sm:top-[96px] sm:px-6">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:max-w-[920px] sm:flex-row">
              {/* You */}
              <div className="relative min-h-0 flex-1 basis-0 overflow-hidden rounded-[24px] bg-[#dfe6fb] shadow-[var(--shadow-panel)]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cam.isMirror ? "scale-x-[-1]" : ""}`}
                />
                {(cam.cameraError || !cam.localStream) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-[15px] font-semibold text-sn-navy">
                      {cam.cameraError ? "Camera is blocked" : "Opening camera…"}
                    </p>
                    {cam.cameraError && (
                      <button onClick={() => cam.startCamera()} className="sn-pill h-10 px-5 text-[14px]">
                        <Camera size={16} strokeWidth={1.9} /> Try again
                      </button>
                    )}
                  </div>
                )}
                {session.meReady && <ReadyMark />}
              </div>
              {/* Partner */}
              <div className="relative min-h-0 flex-1 basis-0 overflow-hidden rounded-[24px] bg-[#e8e5f7] shadow-[var(--shadow-panel)]">
                {partnerLive ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <img
                      src={chibiFor(partner)}
                      alt=""
                      className="h-[72px] w-[64px] rounded-[18px] border-[3px] border-white object-cover opacity-80 grayscale-[35%]"
                    />
                    <p className="text-[15px] font-semibold text-sn-navy">
                      {session.partnerHere ? "Connecting…" : "Camera off"}
                    </p>
                  </div>
                )}
                {session.partnerReady && <ReadyMark />}
              </div>

              <AnimatePresence>
                {counting && session.countdown! > 0 && (
                  <motion.div
                    key={session.countdown}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.3, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="sn-pill pointer-events-none absolute inset-0 z-10 m-auto h-32 w-32 cursor-default"
                  >
                    <span className="font-serif text-[64px] font-bold leading-none text-sn-navy tabular-nums">
                      {session.countdown}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Strip filling up (desktop) */}
            {preview && (
              <div className="hidden min-h-0 shrink-0 items-center lg:flex">
                <img
                  src={preview}
                  alt="Your strip so far"
                  className={`max-h-full rounded-[10px] shadow-[0_24px_48px_-24px_rgba(50,70,150,0.6)] ${session.layout === "strip" ? "w-[190px]" : "w-[260px]"}`}
                />
              </div>
            )}
          </main>

          {/* Strip thumbnail (phone/tablet) */}
          {preview && session.shotIndex > 0 && (
            <img
              src={preview}
              alt="Your strip so far"
              className="absolute right-4 top-[92px] z-20 w-[54px] rounded-[6px] shadow-[0_12px_24px_-12px_rgba(50,70,150,0.7)] sm:right-6 lg:hidden"
            />
          )}

          {/* Floating controls */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {session.shotIndex === 0 && !counting && (
              <div className="flex gap-2">
                {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
                  <button key={id} onClick={() => session.setLayout(id)} className={chip(session.layout === id)}>
                    {LAYOUTS[id].name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={cam.toggleMirror}
                aria-pressed={cam.isMirror}
                aria-label="Mirror camera"
                className={`sn-pill sn-icon-btn h-12 w-12 ${cam.isMirror ? "sn-active" : ""}`}
              >
                <FlipHorizontal2 size={19} strokeWidth={1.9} />
              </button>
              <button
                onClick={() => session.setReady(!session.meReady)}
                disabled={counting || !cam.localStream}
                className={`sn-pill h-14 min-w-[200px] px-8 text-[17px] ${session.meReady || counting ? "sn-active" : ""}`}
              >
                {session.meReady && !counting && <Check size={19} strokeWidth={2.2} />}
                {readyLabel}
              </button>
              <button onClick={cam.toggleFacingMode} aria-label="Switch camera" className="sn-pill sn-icon-btn h-12 w-12">
                <SwitchCamera size={19} strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Result */}
          <main className="absolute inset-x-0 bottom-[260px] top-[84px] flex items-center justify-center px-4 sm:bottom-[230px] sm:top-[96px]">
            {preview && (
              <motion.img
                key={session.layout}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                src={preview}
                alt="Your photo strip"
                className="max-h-full max-w-full rounded-[10px] object-contain shadow-[0_30px_60px_-30px_rgba(50,70,150,0.7)]"
              />
            )}
          </main>

          <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex w-full max-w-[640px] flex-col gap-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
                  <button key={id} onClick={() => session.setLayout(id)} className={chip(session.layout === id)}>
                    {LAYOUTS[id].name}
                  </button>
                ))}
                <span className="mx-1 w-px shrink-0 bg-white/60" />
                {(Object.keys(STYLES) as StyleId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => session.setStyle(id)}
                    aria-label={STYLES[id].name}
                    title={STYLES[id].name}
                    className={`h-9 w-9 shrink-0 rounded-full border-2 transition ${session.style === id ? "border-[#94b2f6] ring-2 ring-white" : "border-white"}`}
                    style={{ background: STYLES[id].bg }}
                  />
                ))}
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button key={f.id} onClick={() => session.setFilter(f.id)} className={chip(session.filterId === f.id)}>
                    {f.name}
                  </button>
                ))}
              </div>
              <input
                value={session.caption}
                onChange={(e) => session.setCaption(e.target.value)}
                placeholder="Caption"
                maxLength={48}
                className="h-11 w-full rounded-full border border-white/80 bg-white/70 px-4 text-[15px] text-sn-navy outline-none backdrop-blur-xl placeholder:text-sn-faint focus:border-sn-periwinkle"
              />
              <div className="flex gap-2">
                {leader && (saveState !== "saved" || savedLook.current !== look) ? (
                  <button onClick={updateAlbum} disabled={saveState === "saving"} className="sn-pill h-12 flex-1 text-[15px]">
                    <BookImage size={18} strokeWidth={1.9} />
                    {saveState === "saving" ? "Saving…" : saved ? "Update album" : "Save to album"}
                  </button>
                ) : (
                  <span className="flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-semibold text-sn-ink">
                    <Check size={18} strokeWidth={2.2} className="text-[#3a9c7a]" /> In your album
                  </span>
                )}
                <button
                  onClick={async () => downloadCanvas(await render(), `seanaya-${session.layout}-${Date.now()}.png`)}
                  className="sn-pill h-12 px-5 text-[15px]"
                >
                  <Download size={18} strokeWidth={1.9} /> PNG
                </button>
                <button onClick={shootAgain} className="sn-pill h-12 px-5 text-[15px]">
                  <RotateCcw size={17} strokeWidth={1.9} /> Again
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReadyMark() {
  return (
    <span className="sn-pill sn-active sn-icon-btn absolute left-3 top-3 h-9 w-9 cursor-default">
      <Check size={17} strokeWidth={2.4} />
    </span>
  );
}
