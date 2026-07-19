import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md text-center p-10">
        <h1 className="display text-6xl text-foreground">Lost lily</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This corner of Seanaya hasn't bloomed yet.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90 transition"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md text-center p-10 overflow-auto max-h-screen">
        <h1 className="display text-2xl text-foreground">A gentle pause</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something didn't load. Try again in a moment.
        </p>
        <div className="mt-4 p-4 bg-black/10 rounded-lg text-left overflow-auto max-h-60">
          <p className="font-bold text-red-500 text-xs">{error.message}</p>
          <pre className="text-[10px] text-muted-foreground mt-2 whitespace-pre-wrap">
            {error.stack}
          </pre>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground shadow-soft"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border bg-background px-5 py-2 text-sm">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Seanaya — Your quiet space, together" },
      { name: "description", content: "Our own digital space." },
      { name: "author", content: "Seanaya" },
      { property: "og:title", content: "Seanaya" },
      { property: "og:description", content: "Our own digital space." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://seanaya.vercel.app/main-lily.png" },
      { property: "og:image:width", content: "500" },
      { property: "og:image:height", content: "500" },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Seanaya" },
      { name: "twitter:description", content: "Our own digital space." },
      { name: "twitter:image", content: "https://seanaya.vercel.app/main-lily.png" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Seanaya" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/lily1.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Nunito:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        position="top-center"
        visibleToasts={1}
        toastOptions={{ className: "glass-panel" }}
      />
    </QueryClientProvider>
  );
}
