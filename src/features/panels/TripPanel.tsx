import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { MapPin, Sparkles, Clock } from "lucide-react";

export function TripPanel({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"visited" | "dream" | "planned">("visited");

  const { data: trips = [] } = useQuery({
    queryKey: ["trips", relationshipId],
    queryFn: async () => (await supabase.from("trips").select("*").eq("relationship_id", relationshipId).order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title || !location) throw new Error("Title & location required");
      const { error } = await supabase.from("trips").insert({ relationship_id: relationshipId, created_by: user.id, title, location, status });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pinned to your map"); setTitle(""); setLocation(""); qc.invalidateQueries({ queryKey: ["trips"] }); qc.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const iconOf = (s: string) => s === "visited" ? <MapPin size={14} className="text-lily-stem" /> : s === "dream" ? <Sparkles size={14} className="text-primary" /> : <Clock size={14} className="text-warm" />;

  return (
    <div className="p-8">
      <h2 className="display text-3xl">Travel Map</h2>
      <p className="mt-1 text-sm text-muted-foreground">Places you've been. Places you dream about.</p>

      <div className="soft-card mt-4 p-4 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A name for this trip" className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where?" className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
        <div className="flex gap-2">
          {(["visited","dream","planned"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`flex-1 rounded-full px-3 py-1.5 text-xs capitalize transition ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{s}</button>
          ))}
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground shadow-soft">Add pin</button>
      </div>

      <div className="mt-6 space-y-2">
        {trips.map((t) => (
          <div key={t.id} className="soft-card p-3 flex items-center gap-3">
            {iconOf(t.status)}
            <div className="flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.location}</div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
