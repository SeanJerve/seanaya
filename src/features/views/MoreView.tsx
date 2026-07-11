import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, MapPin, Music2, Settings, Plus, PawPrint } from "lucide-react";
import { useAppStore } from "@/features/app/store";

export function MoreView({ relationshipId }: { relationshipId: string }) {
  const { openSheet } = useAppStore();

  const { data: trips = [] } = useQuery({
    queryKey: ["trips", relationshipId],
    queryFn: async () => (await supabase.from("trips").select("*").eq("relationship_id", relationshipId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: songs = [] } = useQuery({
    queryKey: ["songs", relationshipId],
    queryFn: async () => (await supabase.from("songs").select("*").eq("relationship_id", relationshipId).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: pets = [] } = useQuery({
    queryKey: ["pets", relationshipId],
    queryFn: async () => (await supabase.from("pets").select("*").eq("relationship_id", relationshipId)).data ?? [],
  });

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 py-6 pb-32">
      <Section
        title="Places"
        subtitle="Been, dreamed, planned."
        icon={<MapPin size={14} />}
        onAdd={() => openSheet("add-trip")}
      >
        {trips.length === 0 ? (
          <Empty text="No places pinned yet." />
        ) : (
          <ul className="space-y-1.5">
            {trips.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">{t.location}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Radio"
        subtitle="Songs that live in your room."
        icon={<Music2 size={14} />}
        onAdd={() => openSheet("add-song")}
      >
        {songs.length === 0 ? (
          <Empty text="No songs yet." />
        ) : (
          <ul className="space-y-1.5">
            {songs.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">{s.artist ?? "Unknown"}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Little Pets" subtitle="Names that live here too." icon={<PawPrint size={14} />}>
        {pets.length === 0 ? <Empty text="No pets added yet." /> : (
          <ul className="space-y-1.5">
            {pets.map((p) => (
              <li key={p.id} className="rounded-2xl bg-white/40 px-4 py-2.5 text-sm">{p.name}</li>
            ))}
          </ul>
        )}
      </Section>

      <button
        onClick={() => openSheet("settings")}
        className="flex w-full items-center justify-between rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-foreground/70" />
          <div>
            <div className="text-sm font-medium">Settings</div>
            <div className="text-[11px] text-muted-foreground">Name, PIN, anniversary, partner link.</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-foreground/40" />
      </button>
    </div>
  );
}

function Section({ title, subtitle, icon, onAdd, children }: {
  title: string; subtitle: string; icon: React.ReactNode; onAdd?: () => void; children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/40 bg-white/50 backdrop-blur-xl p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {icon} {title}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {onAdd && (
          <button onClick={onAdd} className="rounded-full border border-white/50 bg-white/60 px-3 py-1 text-[11px]">
            <Plus size={12} className="mr-1 inline" /> Add
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs italic text-muted-foreground">{text}</div>;
}
