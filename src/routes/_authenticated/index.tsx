import { createFileRoute } from "@tanstack/react-router";
import { SeanayaApp } from "@/features/app/SeanayaApp";

export const Route = createFileRoute("/_authenticated/")({
  component: SeanayaApp,
});
