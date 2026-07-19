import { createFileRoute } from "@tanstack/react-router";
import { SeanayaApp } from "@/features/app/SeanayaApp";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seanaya" },
      {
        name: "description",
        content: "Our own digital space.",
      },
    ],
  }),
  component: SeanayaApp,
});
