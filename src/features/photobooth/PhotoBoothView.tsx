import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Download,
  FlipHorizontal2,
  RotateCcw,
  SwitchCamera,
  BookImage,
  Camera,
  Expand,
} from "lucide-react";
import { useWebRTC } from "./useWebRTC";
import { useBoothSession } from "./useBoothSession";
import {
  FILTERS,
  LAYOUTS,
  STYLES,
  downloadCanvas,
  renderBooth,
  renderShotImage,
  type LayoutId,
  type StyleId,
} from "./booth-templates";
import { saveStripToAlbumBook } from "./album-save";
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const cam = useWebRTC({ relationshipId, userSlot: slot, enabled: true });
  // Callback refs: the <video> elements remount after Discard, and each new one needs the stream.
  const attach = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  };
  const localRef = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    attach(el, cam.localStream);
  };
  const remoteRef = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    attach(el, cam.remoteStream);
  };
  useEffect(() => attach(localVideoRef.current, cam.localStream), [cam.localStream]);
  useEffect(
    () => attach(remoteVideoRef.current, cam.remoteStream),
    [cam.remoteStream, cam.peerConnected],
  );

  const session = useBoothSession({
    relationshipId,
    slot,
    name: me,
    capture: () =>
      localVideoRef.current ? cam.captureLocalFrame(localVideoRef.current) || null : null,
    onShotTaken: () => {
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 280);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    },
  });

  // Live render of the strip as frames come in
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // Short delay so typing a caption doesn't re-render the whole strip per keystroke.
    const t = setTimeout(() => {
      renderBooth({
        layout: session.layout,
        style: session.style,
        filterId: session.filterId,
        shots: session.shots,
        caption: session.caption,
        names,
      }).then((c) => alive && setPreview(c.toDataURL("image/jpeg", 0.92)));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [session.layout, session.style, session.filterId, session.shots, session.caption, names]);

  // The latest frame (your photo and your partner's side by side), for the in-shoot viewer.
  const takenIdx = session.shots.map((s, i) => (s && (s.a || s.b) ? i : -1)).filter((i) => i >= 0);
  const lastIdx = takenIdx.length ? takenIdx[takenIdx.length - 1] : -1;
  const [viewer, setViewer] = useState<{ kind: "shot" | "strip"; index: number } | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const viewIdx = viewer?.kind === "shot" ? viewer.index : lastIdx;
  useEffect(() => {
    const shot = viewIdx >= 0 ? session.shots[viewIdx] : undefined;
    if (!shot) {
      setShotUrl(null);
      return;
    }
    let alive = true;
    renderShotImage(shot, session.filterId).then(
      (c) => alive && setShotUrl(c.toDataURL("image/jpeg", 0.9)),
    );
    return () => {
      alive = false;
    };
  }, [viewIdx, session.shots, session.filterId]);
  useEffect(() => {
    if (viewIdx === lastIdx) setLastUrl(shotUrl);
  }, [shotUrl, viewIdx, lastIdx]);
  // Close the viewer when a countdown starts so nobody misses the shot.
  useEffect(() => {
    if (session.countdown !== null) setViewer(null);
  }, [session.countdown]);
  useEffect(() => {
    if (lastIdx < 0) setViewer(null);
  }, [lastIdx]);

  // Nothing is saved automatically: you look at the result, then keep it or not.
  const [saving, setSaving] = useState(false);
  const render = () =>
    renderBooth({
      layout: session.layout,
      style: session.style,
      filterId: session.filterId,
      shots: session.shots,
      caption: session.caption,
      names,
    });

  const keep = async () => {
    if (saving) return;
    setSaving(true);
    const token = await session.claimKeep();
    if (token === null) {
      setSaving(false);
      if (!session.kept) toast(`${partner} is keeping this one`);
      return;
    }
    try {
      await saveStripToAlbumBook({
        canvas: await render(),
        relationshipId,
        title:
          session.caption.trim() ||
          (together ? `Photo booth with ${partner}` : `Photo booth, ${me}`),
        description: together ? "Taken together in the photo booth." : "Taken in the photo booth.",
      });
      session.markKept(token);
      toast.success("Kept in your album");
    } catch {
      session.keepFailed();
      toast.error("Couldn't save to the album. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => session.reset();

  const downloadShot = async (i: number) => {
    const shot = session.shots[i];
    if (!shot) return;
    downloadCanvas(
      await renderShotImage(shot, session.filterId),
      `seanaya-frame-${i + 1}-${Date.now()}.png`,
    );
  };

  const partnerLive = cam.peerConnected && !!cam.remoteStream;
  const counting = session.countdown !== null;
  const chip = (on: boolean) => `sn-pill h-9 shrink-0 px-4 text-[13.5px] ${on ? "sn-active" : ""}`;

  const together = session.mode === "together";
  let readyLabel = "Ready";
  if (counting) readyLabel = "Smile";
  else if (together && !session.partnerHere)
    readyLabel = session.meReady ? `Waiting for ${partner} to join` : "Ready";
  else if (together && session.meReady && !session.partnerReady)
    readyLabel = `Waiting for ${partner}`;
  else if (together && !session.meReady && session.partnerReady) readyLabel = `${partner} is ready`;

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
          <button
            onClick={() => setTab("home")}
            aria-label="Back to home"
            className="sn-pill sn-icon-btn h-11 w-11"
          >
            <ArrowLeft size={19} strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="font-serif text-[24px] font-semibold leading-tight text-sn-navy sm:text-[28px]">
              Photo booth
            </h1>
            <p className="flex items-center gap-2 text-[13.5px] text-sn-ink">
              {together ? (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${session.partnerHere ? "bg-sn-mint" : "bg-[#c6cbe3]"}`}
                  />
                  {session.partnerHere ? `${partner} is here` : `${partner} isn't in the booth`}
                </>
              ) : (
                "Solo shoot"
              )}
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
                  ref={localRef}
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
                      <button
                        onClick={() => cam.startCamera()}
                        className="sn-pill h-10 px-5 text-[14px]"
                      >
                        <Camera size={16} strokeWidth={1.9} /> Try again
                      </button>
                    )}
                  </div>
                )}
                {session.meReady && <ReadyMark />}
              </div>
              {/* Partner (Solo hides it so your camera gets the whole stage) */}
              {together && (
                <div className="relative min-h-0 flex-1 basis-0 overflow-hidden rounded-[24px] bg-[#e8e5f7] shadow-[var(--shadow-panel)]">
                  {partnerLive ? (
                    <video
                      ref={remoteRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
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
              )}

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
                <button
                  onClick={() => lastIdx >= 0 && setViewer({ kind: "strip", index: lastIdx })}
                  disabled={lastIdx < 0}
                  aria-label="View the strip so far"
                  className="max-h-full rounded-[10px] transition enabled:hover:-translate-y-0.5"
                >
                  <img
                    src={preview}
                    alt="Your strip so far"
                    className={`max-h-[calc(100dvh-300px)] rounded-[10px] shadow-[0_24px_48px_-24px_rgba(50,70,150,0.6)] ${session.layout === "strip" ? "w-[190px]" : "w-[260px]"}`}
                  />
                </button>
              </div>
            )}
          </main>

          {/* Latest photo + strip so far (phone/tablet): tap to look closer */}
          <AnimatePresence>
            {lastIdx >= 0 && !counting && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="absolute right-7 top-[96px] z-20 flex flex-col items-end gap-2 sm:right-9 sm:top-[110px] lg:hidden"
              >
                <motion.button
                  key={`shot-${lastIdx}`}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  onClick={() => setViewer({ kind: "shot", index: lastIdx })}
                  aria-label={`View photo ${lastIdx + 1}`}
                  className="h-[58px] w-[76px] overflow-hidden rounded-[14px] border-[3px] border-white bg-[#dfe6fb] shadow-[0_14px_28px_-14px_rgba(50,70,150,0.75)]"
                >
                  {lastUrl && <img src={lastUrl} alt="" className="h-full w-full object-cover" />}
                </motion.button>
                {preview && session.total > 1 && (
                  <button
                    onClick={() => setViewer({ kind: "strip", index: lastIdx })}
                    aria-label="View the strip so far"
                    className="overflow-hidden rounded-[8px] shadow-[0_14px_28px_-14px_rgba(50,70,150,0.75)]"
                  >
                    <img
                      src={preview}
                      alt=""
                      className={session.layout === "strip" ? "w-[46px]" : "w-[76px]"}
                    />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating controls */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {(session.shotIndex === 0 || (together && !session.partnerHere)) && !counting && (
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
                <div className="flex gap-2">
                  {(["solo", "together"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => session.setMode(m)}
                      aria-pressed={session.mode === m}
                      className={chip(session.mode === m)}
                    >
                      {m === "solo" ? "Solo" : "Together"}
                    </button>
                  ))}
                </div>
                <span className="hidden w-px self-stretch bg-white/70 sm:block" />
                <div className="flex gap-2">
                  {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
                    <button
                      key={id}
                      onClick={() => session.setLayout(id)}
                      className={chip(session.layout === id)}
                    >
                      {LAYOUTS[id].name}
                    </button>
                  ))}
                </div>
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
              <button
                onClick={cam.toggleFacingMode}
                aria-label="Switch camera"
                className="sn-pill sn-icon-btn h-12 w-12"
              >
                <SwitchCamera size={19} strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Result */}
          <main className="absolute inset-x-0 bottom-[330px] top-[84px] flex items-center justify-center px-4 sm:bottom-[300px] sm:top-[96px]">
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
                  <button
                    key={id}
                    onClick={() => session.setLayout(id)}
                    className={chip(session.layout === id)}
                  >
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
                  <button
                    key={f.id}
                    onClick={() => session.setFilter(f.id)}
                    className={chip(session.filterId === f.id)}
                  >
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
              {/* Each frame on its own */}
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto py-0.5">
                {session.shots.slice(0, session.total).map((shot, i) => {
                  const thumb = shot?.a || shot?.b;
                  return thumb ? (
                    <button
                      key={i}
                      onClick={() => setViewer({ kind: "shot", index: i })}
                      aria-label={`View frame ${i + 1}`}
                      title={`View or download frame ${i + 1}`}
                      className="group relative h-14 w-[74px] shrink-0 overflow-hidden rounded-[12px] border-2 border-white shadow-[var(--shadow-pill)]"
                    >
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 grid place-items-center bg-[#1f2a5c]/30 text-white opacity-90 transition group-hover:bg-[#1f2a5c]/45">
                        <Expand size={16} strokeWidth={2} />
                      </span>
                    </button>
                  ) : null;
                })}
              </div>
              <div className="flex gap-2">
                {session.kept ? (
                  <span className="flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-semibold text-sn-ink">
                    <Check size={18} strokeWidth={2.2} className="text-[#3a9c7a]" /> Kept in your
                    album
                  </span>
                ) : (
                  <button
                    onClick={keep}
                    disabled={saving || session.partnerKeeping}
                    className="sn-pill h-12 flex-1 text-[15px]"
                  >
                    <BookImage size={18} strokeWidth={1.9} />
                    {saving
                      ? "Keeping…"
                      : session.partnerKeeping
                        ? `${partner} is keeping it`
                        : "Keep"}
                  </button>
                )}
                <button
                  onClick={async () =>
                    downloadCanvas(await render(), `seanaya-${session.layout}-${Date.now()}.png`)
                  }
                  className="sn-pill h-12 px-5 text-[15px]"
                >
                  <Download size={18} strokeWidth={1.9} /> Strip
                </button>
                <button onClick={discard} className="sn-ghost h-12 px-5 text-[15px]">
                  <RotateCcw size={17} strokeWidth={1.9} /> {session.kept ? "New shoot" : "Discard"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {viewer && (
          <ShotViewer
            kind={viewer.kind}
            index={viewer.kind === "shot" ? viewer.index : lastIdx}
            taken={takenIdx}
            total={session.total}
            shotUrl={shotUrl}
            stripUrl={preview}
            onKind={(kind) =>
              setViewer({ kind, index: viewer.kind === "shot" ? viewer.index : lastIdx })
            }
            onIndex={(index) => setViewer({ kind: "shot", index })}
            onDownload={() =>
              viewer.kind === "shot"
                ? downloadShot(viewer.index)
                : render().then((c) =>
                    downloadCanvas(c, `seanaya-${session.layout}-so-far-${Date.now()}.png`),
                  )
            }
            onClose={() => setViewer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShotViewer({
  kind,
  index,
  taken,
  total,
  shotUrl,
  stripUrl,
  onKind,
  onIndex,
  onDownload,
  onClose,
}: {
  kind: "shot" | "strip";
  index: number;
  taken: number[];
  total: number;
  shotUrl: string | null;
  stripUrl: string | null;
  onKind: (k: "shot" | "strip") => void;
  onIndex: (i: number) => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  const pos = taken.indexOf(index);
  const prev = pos > 0 ? taken[pos - 1] : null;
  const next = pos >= 0 && pos < taken.length - 1 ? taken[pos + 1] : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (kind === "shot" && e.key === "ArrowLeft" && prev !== null) onIndex(prev);
      if (kind === "shot" && e.key === "ArrowRight" && next !== null) onIndex(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, prev, next, onClose, onIndex]);
  const src = kind === "shot" ? shotUrl : stripUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // While fading out it must not swallow the next tap.
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={kind === "shot" ? `Photo ${index + 1}` : "Strip so far"}
      className="fixed inset-0 z-40 flex flex-col bg-[#eef1fb]/80 backdrop-blur-2xl"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Back to the booth"
          className="sn-pill sn-icon-btn h-11 w-11"
        >
          <ArrowLeft size={19} strokeWidth={2} />
        </button>
        {total > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => onKind("shot")}
              aria-pressed={kind === "shot"}
              className={`sn-pill h-10 px-4 text-[14px] ${kind === "shot" ? "sn-active" : ""}`}
            >
              Photo
            </button>
            <button
              onClick={() => onKind("strip")}
              aria-pressed={kind === "strip"}
              className={`sn-pill h-10 px-4 text-[14px] ${kind === "strip" ? "sn-active" : ""}`}
            >
              Strip
            </button>
          </div>
        )}
        <button
          onClick={onDownload}
          aria-label="Download"
          className="sn-pill sn-icon-btn h-11 w-11"
        >
          <Download size={19} strokeWidth={1.9} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-5 sm:px-8">
        {src && (
          <motion.img
            key={`${kind}-${index}`}
            src={src}
            alt=""
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            drag={kind === "shot" && taken.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && next !== null) onIndex(next);
              else if (info.offset.x > 60 && prev !== null) onIndex(prev);
            }}
            onClick={(e) => e.stopPropagation()}
            className={`max-h-full max-w-full touch-pan-y select-none object-contain shadow-[0_30px_60px_-30px_rgba(50,70,150,0.7)] ${kind === "shot" ? "rounded-[18px]" : "rounded-[10px]"}`}
          />
        )}
      </div>

      <div
        className="flex h-[76px] items-start justify-center gap-4 pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "shot" && taken.length > 1 && (
          <>
            <button
              onClick={() => prev !== null && onIndex(prev)}
              disabled={prev === null}
              aria-label="Previous photo"
              className="sn-pill sn-icon-btn h-11 w-11 disabled:opacity-40"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <span className="self-center font-serif text-[17px] font-semibold text-sn-navy tabular-nums">
              {index + 1} / {total}
            </span>
            <button
              onClick={() => next !== null && onIndex(next)}
              disabled={next === null}
              aria-label="Next photo"
              className="sn-pill sn-icon-btn h-11 w-11 disabled:opacity-40"
            >
              <ArrowLeft size={18} strokeWidth={2} className="rotate-180" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ReadyMark() {
  return (
    <span className="sn-pill sn-active sn-icon-btn absolute left-3 top-3 h-9 w-9 cursor-default">
      <Check size={17} strokeWidth={2.4} />
    </span>
  );
}
