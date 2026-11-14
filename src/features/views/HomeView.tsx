import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { animate, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useAppStore } from "@/features/app/store";
import { Plus, Heart, SquarePen, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { useLongPress } from "@/hooks/useLongPress";
import { useCoupleLocations, useCoupleNames } from "@/hooks/useCouple";
import { LongPressModal } from "@/components/ui/LongPressModal";
import { burstHearts } from "@/components/seanaya/HeartBurst";
import { ART, Bow, ChibiTile, HeartRibbon, Polaroid, chibiFor } from "@/components/seanaya/art";

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
  const myCity =
    loc.mine?.city ?? (loc.status === "denied" ? "Location off" : loc.status === "unsupported" ? "Location unavailable" : "Locating…");
  const partnerCity = loc.partner?.city ?? "Not shared yet";

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
  // No anniversary yet → we don't invent one; the count/milestone sections are
  // replaced by a prompt to set it in Settings. `start` still needs a value so
  // the hooks below stay unconditional, but it is never shown.
  const hasAnniversary = !!anniversary;
  const start = useMemo(
    () => (anniversary ? parseISO(anniversary) : startOfDay(new Date())),
    [anniversary],
  );
  // The page only needs the minute; the seconds tick inside <Clock/> on their own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const together = useMemo(() => {
    // Calendar days in local time; the clock part is time since local midnight.
    if (now.getTime() < start.getTime()) return { days: 0, hours: 0, mins: 0, secs: 0 };
    return {
      days: differenceInCalendarDays(now, start),
      hours: now.getHours(),
      mins: now.getMinutes(),
      secs: now.getSeconds(),
    };
  }, [now, start]);

  // ── Monthsary cycle (anniversary day of every month) ──
  // Anniversaries on the 29th–31st land on the last day of shorter months.
  const monthDay = start.getDate();
  const monthsaryIn = (year: number, month: number) =>
    new Date(year, month, Math.min(monthDay, getDaysInMonth(new Date(year, month, 1))));
  const dayKey = format(now, "yyyy-MM-dd");
  const { nextMonthsary, prevMonthsary, thisMonthsary } = useMemo(() => {
    const today = new Date();
    const current = monthsaryIn(today.getFullYear(), today.getMonth());
    const next =
      today >= current ? monthsaryIn(today.getFullYear(), today.getMonth() + 1) : current;
    const prev = monthsaryIn(next.getFullYear(), next.getMonth() - 1);
    return { nextMonthsary: next, prevMonthsary: prev, thisMonthsary: current };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDay, dayKey]);
  const daysLeft = Math.max(0, differenceInCalendarDays(nextMonthsary, now));
  const isMonthsaryToday = hasAnniversary && isSameDay(now, thisMonthsary);
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
    : hasAnniversary
      ? {
          date: nextMonthsary,
          title: `Our ${ordinal(monthsaryNumber)} monthsary`,
          detail: `${format(nextMonthsary, "EEEE, MMMM d")} · ${differenceInCalendarDays(nextMonthsary, start)} days together`,
        }
      : null;

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
      localStorage.setItem("intro-dismissed-home", "true");
    }
  }, []);
  const longPressProps = useLongPress({ onLongPress: () => setShowGuide(true), onClick: () => {} });

  return (
    <div className="relative mx-auto w-full max-w-[640px] px-4 pb-32 pt-5 sm:px-6 lg:max-w-[1186px] lg:pt-4">
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

      <div className="grid gap-y-12 pt-4 lg:grid-cols-[minmax(0,1.225fr)_minmax(0,1fr)] lg:gap-x-16 lg:gap-y-14 lg:pt-8">
        {/* ───── Postcard: the two of you ───── */}
        <section className="@container flex flex-col justify-between gap-6">
          <div className="relative grid grid-cols-2 items-center gap-4 @min-[570px]:flex @min-[570px]:justify-between">
            <Person side="left" name={me} city={myCity} portrait={chibiFor(me)} />
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[30px] w-[30%] -translate-x-1/2 @min-[570px]:top-1/2 @min-[570px]:w-[26%] @min-[570px]:-translate-y-[60%]"
            >
              <HeartRibbon className="w-full" />
            </div>
            <Person side="right" name={partner} city={partnerCity} portrait={chibiFor(partner)} />
            {loc.distanceKm !== null && (
              <div className="col-span-2 -mt-1 text-center text-[14px] text-[#545e88] tabular-nums @min-[570px]:absolute @min-[570px]:left-1/2 @min-[570px]:top-1/2 @min-[570px]:mt-0 @min-[570px]:-translate-x-1/2 @min-[570px]:translate-y-[2px]">
                {loc.distanceKm.toLocaleString()} km apart
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <button
              onClick={(e) => {
                if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([40, 80, 40]);
                burstHearts(e);
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
        </section>

        {/* ───── Studio ───── */}
        <section
          onClick={() => setTab("photobooth")}
          className="group flex cursor-pointer flex-col"
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
            <div className="flex min-w-0 flex-1 flex-col justify-center self-stretch">
              <h3 className="font-serif text-[21px] font-semibold leading-tight text-sn-navy sm:text-[24px]">
                Remote Photo Booth
              </h3>
              <span className="sn-pill mt-5 h-11 self-start px-5 text-[14.5px]">
                Enter booth
                <ArrowRight size={17} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
            <Bow className="absolute -bottom-1 right-0 hidden h-10 w-12 text-[#a9b4e4] sm:block" />
          </div>
        </section>

        {!hasAnniversary ? (
          <section className="flex flex-col justify-center lg:col-span-2">
            <h2 className="sn-label">Together</h2>
            <h3 className="mt-3 font-serif text-[22px] font-semibold leading-tight text-sn-navy">
              When did your story start?
            </h3>
            <p className="mt-1 text-[14.5px] text-sn-muted">
              Set your anniversary to count your days together and your monthsaries.
            </p>
            <button
              onClick={() => openSheet("settings")}
              className="sn-pill mt-4 h-11 self-start px-5 text-[14.5px]"
            >
              Set anniversary
              <ArrowRight size={17} strokeWidth={2} />
            </button>
          </section>
        ) : (
        <>
        {/* ───── Together ───── */}
        <section
          {...longPressProps}
          className="relative flex flex-col justify-center"
        >
          <h2 className="sn-label">Together</h2>
          <div className="relative z-10 mt-3 flex items-baseline gap-3">
            <span className="font-serif text-[72px] font-bold leading-none tracking-[-0.02em] text-sn-navy tabular-nums sm:text-[84px]">
              <CountUp value={together.days} />
            </span>
            <span className="font-serif text-[28px] text-sn-ink">days</span>
          </div>
          <Clock className="relative z-10 mt-2 text-[16px] font-semibold tracking-[0.03em] text-sn-ink tabular-nums" />
          <div className="relative z-10 mt-1 text-[14.5px] text-sn-muted">
            since {format(start, "MMMM d, yyyy")}
          </div>
          <img
            src={ART.lilyOpen}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-6 right-0 hidden w-[150px] rotate-[-24deg] select-none sm:block"
          />
        </section>

        {/* ───── Monthly milestone ───── */}
        <section
          onClick={openMonthsary}
          title="Open our monthsary story"
          className="@container flex cursor-pointer flex-col justify-center"
        >
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
        </>
        )}

        {/* ───── Upcoming moments ───── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="sn-label">Upcoming moments</h2>
            <button onClick={() => setTab("calendar")} className="sn-pill relative z-10 h-9 px-4 text-[14px]">
              Calendar
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="relative mt-5 sm:pr-[190px]">
            <div className="flex flex-wrap items-center gap-4">
              {upcoming ? (
                <>
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
                </>
              ) : (
                <div className="min-w-0 flex-1 basis-[150px]">
                  <h3 className="font-serif text-[21px] font-semibold leading-tight text-sn-navy">
                    Nothing planned yet
                  </h3>
                  <p className="mt-1 text-[14.5px] text-sn-ink">Add a moment to count down to.</p>
                </div>
              )}
              <button onClick={() => openSheet("add-event")} className="sn-pill h-11 w-full px-5 text-[14.5px] sm:w-auto">
                <Plus size={17} strokeWidth={2} />
                Add moment
              </button>
            </div>
            <img
              src={ART.bouquet}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -bottom-8 right-2 hidden w-[160px] select-none [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_55%,transparent_100%)] sm:block"
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

/** Hours, minutes and seconds of today, ticking on its own so the page doesn't re-render. */
function Clock({ className }: { className?: string }) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={className}>
      {p(t.getHours())}h {p(t.getMinutes())}m {p(t.getSeconds())}s
    </div>
  );
}

/** Counts up to the number the first time it shows. */
function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const done = useRef(false);
  useEffect(() => {
    if (reduce || done.current) {
      setShown(value);
      return;
    }
    done.current = true;
    const controls = animate(0, value, {
      duration: Math.min(1.6, 0.6 + value / 400),
      ease: [0.16, 0.84, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{shown}</>;
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
  const wiggle = useAnimationControls();
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center @min-[570px]:flex-row @min-[570px]:gap-4 ${
        right ? "@min-[570px]:flex-row-reverse @min-[570px]:text-right" : "@min-[570px]:text-left"
      }`}
    >
      <motion.button
        type="button"
        aria-label={`${name}`}
        animate={wiggle}
        whileTap={{ scale: 0.93 }}
        onClick={(e) => {
          burstHearts(e.currentTarget, 5);
          wiggle.start({ rotate: [0, -7, 6, -3, 0], transition: { duration: 0.5, ease: "easeInOut" } });
        }}
        className="sn-float shrink-0 rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[#94b2f6]"
        style={{ animationDelay: right ? "-2.1s" : "0s" }}
      >
        <ChibiTile
          src={portrait}
          alt={name}
          className="h-[96px] w-[84px] @min-[420px]:h-[110px] @min-[420px]:w-[96px] @min-[570px]:h-[128px] @min-[570px]:w-[112px]"
        />
      </motion.button>
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
