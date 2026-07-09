import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, differenceInMonths, differenceInYears, format } from "date-fns";
import { Heart, Camera, Plane, Sparkles, Flower2 } from "lucide-react";

export function DashboardPanel({ relationshipId, anniversary }: { relationshipId: string; anniversary: string | null }) {
  const { data: stats } = useQuery({
    queryKey: ["stats", relationshipId],
    queryFn: async () => {
      const [mem, trip, hug, lily, ev] = await Promise.all([
        supabase.from("memories").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("hugs").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("lilies").select("id", { count: "exact", head: true }).eq("relationship_id", relationshipId),
        supabase.from("events").select("*").eq("relationship_id", relationshipId).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
      ]);
      return {
        memories: mem.count ?? 0,
        trips: trip.count ?? 0,
        hugs: hug.count ?? 0,
        lilies: lily.count ?? 0,
        nextEvent: ev.data?.[0] ?? null,
      };
    },
  });

  const start = anniversary ? new Date(anniversary) : null;
  const today = new Date();
  const days = start ? differenceInDays(today, start) : 0;
  const months = start ? differenceInMonths(today, start) : 0;
  const years = start ? differenceInYears(today, start) : 0;

  return (
    <div className="glass-panel h-full flex flex-col p-5 gap-4 overflow-hidden">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Our Story</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="display text-4xl leading-none">{days}</span>
          <span className="text-xs text-muted-foreground">days together</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {years > 0 && <span>{years}y · </span>}{months}mo
          {!start && <span className="italic"> — set your anniversary in settings</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCell icon={<Camera size={14} />} label="Memories" value={stats?.memories ?? 0} />
        <StatCell icon={<Plane size={14} />} label="Trips" value={stats?.trips ?? 0} />
        <StatCell icon={<Heart size={14} />} label="Hugs" value={stats?.hugs ?? 0} />
        <StatCell icon={<Flower2 size={14} />} label="Lilies" value={stats?.lilies ?? 0} />
      </div>

      <div className="soft-card p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Sparkles size={12} /> Next moment
        </div>
        {stats?.nextEvent ? (
          <>
            <div className="mt-2 display text-lg leading-tight">{stats.nextEvent.title}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(stats.nextEvent.starts_at), "EEE, MMM d")}</div>
            <div className="mt-2 text-xs text-primary">
              in {Math.max(0, differenceInDays(new Date(stats.nextEvent.starts_at), today))} days
            </div>
          </>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground italic">Nothing on the horizon yet.</div>
        )}
      </div>

      <div className="mt-auto text-[10px] text-muted-foreground text-center opacity-60">
        Made for two · Seanaya
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="soft-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 display text-2xl leading-none">{value}</div>
    </div>
  );
}
