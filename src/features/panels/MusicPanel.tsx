import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Music2, Star } from "lucide-react";

const CATS = ["favorite","study","travel","comfort","future"] as const;

export function MusicPanel({ relationshipId }: { relationshipId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cat, setCat] = useState<typeof CATS[number]>("favorite");

  const { data: songs = [] } = useQuery({
    queryKey: ["songs", relationshipId],
    queryFn: async () => (await supabase.from("songs").select("*").eq("relationship_id", relationshipId).order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!title) throw new Error("Song title?");
      const { error } = await supabase.from("songs").insert({ relationship_id: relationshipId, title, artist: artist || null, category: cat });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setArtist(""); toast.success("Added to your radio"); qc.invalidateQueries({ queryKey: ["songs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-8">
      <h2 className="display text-3xl flex items-center gap-2"><Music2 /> Our Radio</h2>
      <p className="mt-1 text-sm text-muted-foreground">Songs that live in your room.</p>

      <div className="soft-card mt-4 p-4 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm" />
        <select value={cat} onChange={(e) => setCat(e.target.value as typeof CATS[number])} className="w-full rounded-full border border-border bg-background/60 px-4 py-2 text-sm capitalize">
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => add.mutate()} disabled={add.isPending} className="w-full rounded-full bg-primary py-2 text-sm text-primary-foreground shadow-soft">Add song</button>
      </div>

      <div className="mt-6 space-y-2">
        {songs.length === 0 && <div className="text-sm text-muted-foreground italic">The room is quiet. Add the first song.</div>}
        {songs.map((s) => (
          <div key={s.id} className="soft-card p-3 flex items-center gap-3">
            <Music2 size={16} className="text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.artist ?? "Unknown"} · {s.category}</div>
            </div>
            {s.favorite && <Star size={14} className="text-warm" />}
          </div>
        ))}
      </div>
    </div>
  );
}
