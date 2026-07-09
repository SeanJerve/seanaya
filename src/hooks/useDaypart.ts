import { useEffect, useState } from "react";

export type Daypart = "morning" | "afternoon" | "evening" | "night";

export function useDaypart(): Daypart {
  const [part, setPart] = useState<Daypart>(() => compute());
  useEffect(() => {
    const t = setInterval(() => setPart(compute()), 60_000);
    return () => clearInterval(t);
  }, []);
  return part;
}

function compute(): Daypart {
  const h = new Date().getHours();
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 20) return "evening";
  return "night";
}

export const daypartGradient: Record<Daypart, string> = {
  morning: "var(--gradient-dawn)",
  afternoon: "var(--gradient-noon)",
  evening: "var(--gradient-dusk)",
  night: "var(--gradient-night)",
};
