import { createFileRoute } from "@tanstack/react-router";
import { SeanayaApp } from "@/features/app/SeanayaApp";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seanaya" },
      { name: "description", content: "A private, illustrated home for two — memories, moments, and gentle keepsakes." },
    ],
  }),
  component: SeanayaApp,
});
