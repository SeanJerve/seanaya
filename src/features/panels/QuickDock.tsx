import { Camera, CalendarPlus, Heart, StickyNote, Plane, Music, Flower2, PawPrint, MailOpen, LogOut } from "lucide-react";
import { usePanel, type PanelKey } from "@/features/app/store";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRelationship } from "@/hooks/useRelationship";
import { useUser } from "@/hooks/useUser";

const items: { key: Exclude<PanelKey, null>; label: string; icon: React.ReactNode }[] = [
  { key: "memory", label: "Memory", icon: <Camera size={18} /> },
  { key: "event", label: "Event", icon: <CalendarPlus size={18} /> },
  { key: "note", label: "Note", icon: <StickyNote size={18} /> },
  { key: "trip", label: "Trip", icon: <Plane size={18} /> },
  { key: "music", label: "Music", icon: <Music size={18} /> },
  { key: "garden", label: "Garden", icon: <Flower2 size={18} /> },
  { key: "pets", label: "Pets", icon: <PawPrint size={18} /> },
  { key: "wall", label: "Wall", icon: <MailOpen size={18} /> },
];

export function QuickDock() {
  const { openPanel, togglePanel } = usePanel();
  const { data: rel } = useRelationship();
  const { user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function sendHug() {
    if (!rel || !user) return;
    const { error } = await supabase.from("hugs").insert({ relationship_id: rel.id, sender_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("A hug on its way 🤍");
    qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="glass-panel flex items-center gap-1 px-3 py-2">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => togglePanel(it.key)}
          className={`group relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition text-[10px]
            ${openPanel === it.key ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground/80"}`}
          title={it.label}
        >
          {it.icon}
          <span className="uppercase tracking-wider">{it.label}</span>
        </button>
      ))}
      <div className="mx-1 h-8 w-px bg-border" />
      <button
        onClick={sendHug}
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-[10px] uppercase tracking-wider text-white shadow-soft transition hover:scale-105"
        style={{ background: "linear-gradient(135deg, oklch(0.82 0.13 15), oklch(0.72 0.15 25))" }}
      >
        <Heart size={18} />
        Hug
      </button>
      <div className="mx-1 h-8 w-px bg-border" />
      <button onClick={signOut} className="p-2 rounded-full text-muted-foreground hover:bg-accent transition" title="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
