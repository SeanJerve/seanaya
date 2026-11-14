import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-6 text-center"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex max-w-sm flex-col items-center">
        <img src="/art/cat-peek.webp" alt="" className="h-[86px] w-auto select-none" draggable={false} />
        <h1 className="mt-4 font-serif text-[34px] font-semibold leading-tight text-sn-navy">Lost lily</h1>
        <p className="sn-hand mt-1 text-[22px] text-[#646d93]">this page hasn't bloomed yet</p>
        <Link to="/" className="sn-pill mt-6 h-12 px-7 text-[15px]">
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-6 text-center"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex max-h-[100dvh] max-w-md flex-col items-center overflow-auto py-8">
        <img src="/art/cat-peek.webp" alt="" className="h-[86px] w-auto select-none" draggable={false} />
        <h1 className="mt-4 font-serif text-[30px] font-semibold leading-tight text-sn-navy">A gentle pause</h1>
        <p className="mt-2 text-[15px] text-sn-ink">Something didn't load. Try again in a moment.</p>
        {/* Technical details only while developing; never shown on the live site */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-4 bg-black/10 rounded-lg text-left overflow-auto max-h-60">
            <p className="font-bold text-red-500 text-xs">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <pre className="text-[11px] text-muted-foreground mt-2 whitespace-pre-wrap">
              {error instanceof Error ? error.stack : null}
            </pre>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="sn-pill h-12 px-6 text-[15px]"
          >
            Try again
          </button>
          <a href="/" className="sn-ghost h-12 px-6 text-[15px]">
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#cdd9f8" },
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
      { rel: "icon", href: "/icon.png?v=3", type: "image/png" },
      { rel: "shortcut icon", href: "/icon.png?v=3" },
      { rel: "apple-touch-icon", href: "/icon.png?v=3" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Nunito+Sans:opsz,wght@6..12,400;6..12,500;6..12,600;6..12,700;6..12,800&family=Caveat:wght@400;500&display=swap",
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
    // Supabase re-announces SIGNED_IN whenever the tab regains focus; only a real
    // change of person should refetch everything.
    let lastUserId: string | null | undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user?.id ?? null;
      if (event === "INITIAL_SESSION") {
        lastUserId = id;
        return;
      }
      if (id === lastUserId) return;
      lastUserId = id;
      router.invalidate();
      if (id) queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Honour "reduce motion" everywhere: lock screen, story, app. */}
      <MotionConfig reducedMotion="user">
        <Outlet />
      </MotionConfig>
      <Toaster
        position="top-center"
        visibleToasts={1}
        offset={{ top: "max(14px, env(safe-area-inset-top))" }}
        mobileOffset={{ top: "max(12px, env(safe-area-inset-top))" }}
        icons={{
          success: <img src="/art/clay-heart-sm.webp" alt="" className="h-[22px] w-[22px]" />,
        }}
        toastOptions={{ unstyled: true, classNames: { toast: "sn-toast", title: "sn-toast-title", description: "sn-toast-desc", icon: "sn-toast-icon" } }}
      />
    </QueryClientProvider>
  );
}
