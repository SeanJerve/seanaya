import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Lily } from "@/components/scene/Lily";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Sign in — Seanaya" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.body.style.overflow = "hidden"; }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Welcome to Seanaya");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "var(--gradient-sky)" }}>
      {/* Ambient lilies */}
      <div className="pointer-events-none absolute inset-0">
        {[15, 35, 62, 82].map((x, i) => (
          <div key={i} className="absolute" style={{ left: `${x}%`, bottom: `${8 + (i % 2) * 12}%`, animation: `float-slow ${6 + i}s ease-in-out infinite` }}>
            <Lily size={80 + i * 8} />
          </div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-panel relative z-10 w-full max-w-md p-10"
      >
        <div className="text-center">
          <div className="mx-auto mb-3"><Lily size={48} /></div>
          <h1 className="display text-4xl">Seanaya</h1>
          <p className="mt-1 text-sm text-muted-foreground">A quiet place, just for the two of you.</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <Field label="Your name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?"
                className="w-full rounded-full border border-border bg-background/60 px-5 py-2.5 outline-none focus:ring-2 focus:ring-ring/60" />
            </Field>
          )}
          <Field label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@together.com"
              className="w-full rounded-full border border-border bg-background/60 px-5 py-2.5 outline-none focus:ring-2 focus:ring-ring/60" />
          </Field>
          <Field label="Password">
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
              className="w-full rounded-full border border-border bg-background/60 px-5 py-2.5 outline-none focus:ring-2 focus:ring-ring/60" />
          </Field>

          <button disabled={loading} type="submit"
            className="mt-2 w-full rounded-full bg-primary py-3 font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60">
            {loading ? "…" : mode === "signin" ? "Enter Seanaya" : "Create our space"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 block w-full text-center text-sm text-muted-foreground hover:text-foreground transition">
          {mode === "signin" ? "First time here? Create an account" : "Already have an account? Sign in"}
        </button>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
