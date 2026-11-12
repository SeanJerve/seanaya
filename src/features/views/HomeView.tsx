import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, differenceInDays, format } from "date-fns";
import { useAppStore } from "@/features/app/store";
import { Plus, Heart, SquarePen, MapPin, ArrowRight, X, Check, Pencil, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { useLongPress } from "@/hooks/useLongPress";
import { useCoupleLocations, useCoupleNames } from "@/hooks/useCouple";
import { LongPressModal } from "@/components/ui/LongPressModal";
import { setPartnerCity } from "@/lib/location-service";
import { ART, Bow, ChibiTile, HeartRibbon, Polaroid, chibiFor } from "@/components/seanaya/art";

const QUICK_CITIES = ["Bacolod", "Manila", "Tokyo", "Cebu City", "Iloilo City", "Davao City", "Baguio", "Dumaguete"];

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function HomeView({
  relationshipId,
  anniversary,
}: {
  relationshipId: string;
  anniversary: string | null;
}) {
  const { openSheet, setTab, openMonthsary } = useAppStore();
  const { user } = useUser();
  const qc = useQueryClient();
  const { me, partner } = useCoupleNames();
  const loc = useCoupleLocations(relationshipId);

  // ── Location editor ──
  const [editing, setEditing] = useState(false);
  const [myDraft, setMyDraft] = useState(loc.mine.city);
  const [partnerDraft, setPartnerDraft] = useState(loc.partner.city);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    if (editing) {
      setMyDraft(loc.mine.city);
      setPartnerDraft(loc.partner.city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const saveLocations = () => {
    if (myDraft.trim()) loc.setMyCity(myDraft.trim());
    if (!loc.partnerIsShared && partnerDraft.trim()) {
      setPartnerCity(partnerDraft.trim());
      loc.setPartnerManual(partnerDraft.trim());
    }
    setEditing(false);
  };

  // ── Next scheduled moment ──
  const { data: nextEvent } = useQuery({
    queryKey: ["events", "next", relationshipId],
    enabled: !!relationshipId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("relationship_id", relationshipId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  // ── Time together ──
  const start = useMemo(
    () => new Date((anniversary || "2026-06-19") + "T00:00:00"),
    [anniversary],
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const together = useMemo(() => {
    const ms = Math.max(0, now.getTime() - start.getTime());
    const s = Math.floor(ms / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor(s / 3600) % 24,
      mins: Math.floor(s / 60) % 60,
      secs: s % 60,
    };
  }, [now, start]);

  // ── Monthsary cycle (anniversary day of every month) ──
  const monthDay = start.getDate();
  const { nextMonthsary, prevMonthsary } = useMemo(() => {
    const today = new Date();
    let next = new Date(today.getFullYear(), today.getMonth(), monthDay);
    if (today >= next) next = addMonths(next, 1);
    return { nextMonthsary: next, prevMonthsary: addMonths(next, -1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDay, now.getDate()]);
  const daysLeft = Math.max(0, differenceInDays(nextMonthsary, now));
  const isMonthsaryToday = now.getDate() === monthDay;
  const progress = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        ((now.getTime() - prevMonthsary.getTime()) /
          (nextMonthsary.getTime() - prevMonthsary.getTime())) *
          100,
      ),
    ),
  );
  const monthsaryNumber = Math.max(
    1,
    (nextMonthsary.getFullYear() - start.getFullYear()) * 12 +
      (nextMonthsary.getMonth() - start.getMonth()),
  );
  const upcoming = nextEvent
    ? {
        date: new Date(nextEvent.starts_at),
        title: nextEvent.title as string,
        detail: format(new Date(nextEvent.starts_at), "EEEE, MMMM d · h:mm a"),
      }
    : {
        date: nextMonthsary,
        title: `Our ${ordinal(monthsaryNumber)} monthsary`,
        detail: `${format(nextMonthsary, "EEEE, MMMM d")} · ${differenceInDays(nextMonthsary, start)} days together`,
      };

  // ── Hug ──
  const hug = useMutation({
    mutationFn: async () => {
      if (!relationshipId || !user) throw new Error("Not linked yet");
      const { error } = await supabase
        .from("hugs")
        .insert({ relationship_id: relationshipId, sender_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Hug sent to ${partner}`);
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: any) => toast.error(e?.message || String(e) || "Try again"),
  });

  // ── First-visit guide ──
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("intro-dismissed-home")) {
      setShowGuide(true);
      localStorage.setItem("intro-dismissed-home", "true");
    }
  }, []);
  const longPressProps = useLongPress({ onLongPress: () => setShowGuide(true), onClick: () => {} });

  return (
    <div className="relative mx-auto w-full max-w-[640px] px-4 pb-32 pt-5 sm:px-6 lg:max-w-[1186px] lg:pt-4 xl:mx-0 xl:max-w-none xl:pl-[22px] xl:pr-9">
      {isMonthsaryToday && (
        <button
          onClick={openMonthsary}
          className="sn-card mb-[18px] flex w-full items-center justify-between gap-4 p-5 text-left sm:px-7"
        >
          <div>
            <div className="font-serif text-[22px] font-semibold text-sn-navy">
              Happy monthsary, {partner}
            </div>
            <p className="mt-0.5 text-[14.5px] text-sn-muted">This month's story is ready.</p>
          </div>
          <span className="sn-pill h-10 shrink-0 px-5 text-[14px]">Open story</span>
        </button>
      )}

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.225fr)_minmax(0,1fr)]">
        {/* ───── Postcard: the two of you ───── */}
        <section className="sn-card @container flex flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-[18px] sm:pt-6">
          {editing && (
            <button
              onClick={() => setEditing(false)}
              aria-label="Close"
              className="sn-ghost sn-icon-btn absolute right-4 top-4 z-10 h-9 w-9"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}

          {editing ? (
            <div className="pr-10">
              <h2 className="font-serif text-[22px] font-semibold text-sn-navy">Where are you today?</h2>
              <label className="mt-4 block text-[13px] font-semibold text-sn-ink">{me}</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={myDraft}
                  onChange={(e) => setMyDraft(e.target.value)}
                  placeholder="City"
                  className="h-11 min-w-0 flex-1 rounded-full border border-[#e1e4f5] bg-white/85 px-4 text-[15px] text-sn-navy outline-none focus:border-sn-periwinkle"
                />
                <button
                  onClick={() => {
                    setLocating(true);
                    loc.locateMe((ok) => {
                      setLocating(false);
                      if (ok) {
                        setEditing(false);
                        toast.success("Location updated");
                      } else toast.error("Location access was blocked");
                    });
                  }}
                  disabled={locating}
                  aria-label="Use my current location"
                  title="Use my current location"
                  className="sn-pill sn-icon-btn h-11 w-11"
                >
                  <LocateFixed size={18} strokeWidth={1.9} />
                </button>
              </div>
              {!loc.partnerIsShared && (
                <>
                  <label className="mt-3 block text-[13px] font-semibold text-sn-ink">{partner}</label>
                  <input
                    value={partnerDraft}
                    onChange={(e) => setPartnerDraft(e.target.value)}
                    placeholder="City"
                    className="mt-1.5 h-11 w-full rounded-full border border-[#e1e4f5] bg-white/85 px-4 text-[15px] text-sn-navy outline-none focus:border-sn-periwinkle"
                  />
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK_CITIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setMyDraft(c)}
                    className={`rounded-full px-3 py-1 text-[13px] transition-colors ${myDraft === c ? "bg-white text-sn-navy shadow-[var(--shadow-pill)]" : "text-sn-ink hover:bg-white/70"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={saveLocations} className="sn-pill mt-4 h-11 px-6 text-[15px]">
                <Check size={17} strokeWidth={2} />
                Save
              </button>
            </div>
          ) : (
            <div className="relative grid flex-1 grid-cols-2 items-center gap-4 @min-[570px]:flex @min-[570px]:justify-between">
              <Person side="left" name={me} city={loc.mine.city} portrait={chibiFor(me)} />
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[30px] flex w-[30%] -translate-x-1/2 flex-col items-center @min-[570px]:top-1/2 @min-[570px]:w-[26%] @min-[570px]:-translate-y-[60%]"
              >
                <HeartRibbon className="w-full" />
              </div>
              <Person side="right" name={partner} city={loc.partner.city} portrait={chibiFor(partner)} />
              <div className="col-span-2 -mt-1 flex items-center justify-center gap-2 text-[14px] text-[#545e88] tabular-nums @min-[570px]:absolute @min-[570px]:left-1/2 @min-[570px]:top-1/2 @min-[570px]:mt-0 @min-[570px]:-translate-x-1/2 @min-[570px]:translate-y-[2px]">
                {loc.distanceKm.toLocaleString()} km apart
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Change locations"
                  title="Change locations"
                  className="sn-pill sn-icon-btn h-7 w-7"
                >
                  <Pencil size={12} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([40, 80, 40]);
                  hug.mutate();
                }}
                disabled={hug.isPending}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] px-2 text-[13px] sm:h-[48px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <Heart size={18} strokeWidth={1.9} />
                Send Hug
              </button>
              <button
                onClick={() => openSheet("add-note")}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] px-2 text-[13px] sm:h-[48px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <SquarePen size={17} strokeWidth={1.9} />
                Leave Note
              </button>
              <button
                onClick={() => openSheet("add-memory")}
                className="sn-pill h-[62px] flex-col gap-1 rounded-[24px] px-2 text-[13px] sm:h-[48px] sm:flex-row sm:gap-2 sm:rounded-full sm:text-[15px]"
              >
                <Plus size={18} strokeWidth={2} />
                Add Memory
              </button>
            </div>
          )}
        </section>

        {/* ───── Studio ───── */}
        <section
          onClick={() => setTab("photobooth")}
          className="sn-card sn-card-lavender group flex cursor-pointer flex-col px-5 pb-5 pt-5 sm:px-[26px] sm:pb-6 sm:pt-[22px]"
        >
          <h2 className="sn-label">Studio</h2>
          <div className="relative mt-4 flex flex-1 items-start gap-5">
            <Polaroid
              src={ART.polaroidSky}
              tape="blue"
              tilt={-6}
              className="ml-1 mt-1 w-[112px] shrink-0 group-hover:rotate-[-3deg] sm:w-[146px]"
              photoClassName="aspect-[128/138]"
            />
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
              <h3 className="font-serif text-[21px] font-semibold leading-tight text-sn-navy sm:text-[24px]">
                Remote Photo Booth
              </h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#5b6489] sm:text-[14.5px]">
                Shoot a four-frame strip together from {loc.mine.city} and {loc.partner.city}. Each
                strip lands in your album.
              </p>
              <span className="sn-pill mt-auto h-11 self-start px-5 text-[14.5px]">
                Enter booth
                <ArrowRight size={17} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <Bow className="absolute -bottom-1 right-0 hidden h-10 w-12 text-[#a9b4e4] sm:block" />
          </div>
        </section>

        {/* ───── Together ───── */}
        <section
          {...longPressProps}
          className="sn-card relative flex flex-col justify-center overflow-hidden px-6 py-6 sm:px-[34px] sm:py-7"
        >
          <h2 className="sn-label">Together</h2>
          <div className="relative z-10 mt-3 flex items-baseline gap-3">
            <span className="font-serif text-[72px] font-bold leading-none tracking-[-0.02em] text-sn-navy tabular-nums sm:text-[84px]">
              {together.days}
            </span>
            <span className="font-serif text-[28px] text-sn-ink">days</span>
          </div>
          <div className="relative z-10 mt-2 text-[16px] font-semibold tracking-[0.03em] text-sn-ink tabular-nums">
            {String(together.hours).padStart(2, "0")}h {String(together.mins).padStart(2, "0")}m{" "}
            {String(together.secs).padStart(2, "0")}s
          </div>
          <div className="relative z-10 mt-1 text-[14.5px] text-sn-muted">
            since {format(start, "MMMM d, yyyy")}
          </div>
          <img
            src={ART.lilyOpen}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-14 -right-8 w-[190px] rotate-[-28deg] select-none"
          />
        </section>

        {/* ───── Monthly milestone ───── */}
        <section className="sn-card @container flex flex-col justify-center px-5 py-6 sm:px-[30px]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="sn-label">Monthly milestone</h2>
            <span className="text-[14px] text-[#5b6489] sm:text-[15px]">
              {ordinal(monthDay)} of each month
            </span>
          </div>
          <div className="mt-6 flex items-end justify-between gap-3">
            <span className="font-serif text-[26px] font-semibold leading-none text-sn-navy @min-[440px]:text-[31px]">
              {isMonthsaryToday
                ? "It's today"
                : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} to go`}
            </span>
            <span className="text-[20px] font-semibold leading-none text-[#e0609a] tabular-nums sm:text-[22px]">
              {progress}%
            </span>
          </div>
          <div className="relative mt-4">
            <img
              src={ART.catPeek}
              alt=""
              aria-hidden
              className="pointer-events-none absolute bottom-[12px] right-[52px] hidden w-[100px] select-none @min-[340px]:block @min-[440px]:right-[56px] @min-[440px]:w-[124px]"
            />
            <div
              className="relative h-[16px] rounded-full bg-[#ebeaf2] shadow-[inset_0_1px_3px_rgba(100,108,160,0.18)]"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress to the next monthsary"
            >
              <div className="sn-progress-fill h-full rounded-full" style={{ width: `${progress}%` }} />
              <img
                src={ART.clayHeart}
                alt=""
                aria-hidden
                className="absolute top-1/2 h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {/* ───── Upcoming moments ───── */}
        <section className="sn-card px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-[22px] lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="sn-label">Upcoming moments</h2>
            <button onClick={() => setTab("calendar")} className="sn-pill h-9 px-4 text-[14px]">
              Calendar
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="relative mt-4 overflow-hidden rounded-[22px] border border-white/80 bg-[linear-gradient(90deg,#fdeef4,#fbf2f7_55%,#f3f0fb)] p-4 sm:pr-[220px]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-[64px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#fde4ee,#f8d0df)] shadow-[0_8px_16px_-10px_rgba(201,69,122,0.55)]">
                <span className="text-[13px] font-semibold uppercase leading-none tracking-[0.04em] text-[#cf4c80]">
                  {format(upcoming.date, "MMM")}
                </span>
                <span className="mt-1 font-serif text-[27px] font-semibold leading-none text-[#c23c71]">
                  {format(upcoming.date, "d")}
                </span>
              </div>
              <div className="min-w-0 flex-1 basis-[150px]">
                <h3 className="font-serif text-[21px] font-semibold leading-tight text-sn-navy">
                  {upcoming.title}
                </h3>
                <p className="mt-1 text-[14.5px] text-sn-ink">{upcoming.detail}</p>
              </div>
              <button onClick={() => openSheet("add-event")} className="sn-pill h-11 w-full px-5 text-[14.5px] sm:w-auto">
                <Plus size={17} strokeWidth={2} />
                Add moment
              </button>
            </div>
            <img
              src={ART.bouquet}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -bottom-6 right-2 hidden w-[200px] select-none sm:block"
            />
          </div>
        </section>
      </div>

      <LongPressModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        title="Our little archive"
        description="Everything the two of you keep lives here: where you both are, the days you've had together, the next moment you're counting down to, and every photo and note in between."
      />
    </div>
  );
}

function Person({
  side,
  name,
  city,
  portrait,
}: {
  side: "left" | "right";
  name: string;
  city: string;
  portrait: string;
}) {
  const right = side === "right";
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center @min-[570px]:flex-row @min-[570px]:gap-4 ${
        right ? "@min-[570px]:flex-row-reverse @min-[570px]:text-right" : "@min-[570px]:text-left"
      }`}
    >
      <ChibiTile
        src={portrait}
        alt={name}
        className="h-[96px] w-[84px] @min-[420px]:h-[110px] @min-[420px]:w-[96px] @min-[570px]:h-[128px] @min-[570px]:w-[112px]"
      />
      <div className="min-w-0">
        <div className="font-serif text-[24px] font-semibold leading-tight text-sn-navy @min-[570px]:text-[27px]">
          {name}
        </div>
        <div
          className={`mt-1 flex items-center justify-center gap-1.5 text-[15px] text-[#545e88] ${right ? "@min-[570px]:justify-end" : "@min-[570px]:justify-start"}`}
        >
          <MapPin size={15} strokeWidth={1.8} className="shrink-0" />
          <span className="max-w-[9rem] truncate">{city}</span>
        </div>
      </div>
    </div>
  );
}
