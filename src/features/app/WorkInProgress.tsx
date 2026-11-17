import { ChibiTile, chibiFor } from "@/components/seanaya/art";

/**
 * While something is being made for one of you, that person sees this instead of the app.
 * Flip LOCK_PARTNER_B to false (and redeploy) to let her back in.
 */
export const LOCK_PARTNER_B = false;

export function WorkInProgress({ name }: { name: string }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "var(--gradient-sky)" }}
    >
      <img
        src="/lily2.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-6 w-[180px] rotate-[18deg] select-none opacity-90"
      />
      <div className="relative flex max-w-sm flex-col items-center">
        <div className="sn-float">
          <ChibiTile src={chibiFor(name)} alt="" className="h-[124px] w-[108px]" />
        </div>
        <img
          src="/art/clay-heart.png"
          alt=""
          aria-hidden
          className="sn-heartbeat -mt-6 ml-24 h-[46px] w-[46px] select-none"
        />
        <div className="mt-3 font-serif text-[15px] font-medium tracking-[0.18em] text-[#38457c]">SEANAYA</div>
        <h1 className="mt-2 font-serif text-[30px] font-semibold leading-tight text-sn-navy">
          Work in progress
        </h1>
        <p className="sn-hand mt-2 text-[23px] leading-snug text-[#646d93]">
          something is being made here, {name}. come back a little later
        </p>
      </div>
    </div>
  );
}
