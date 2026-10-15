"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type ComponentProps,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const SceneNavigation = createContext<(href: string) => void>(() => {});

/** Resolve the snapshot only after the destination route has committed. */
export function SceneNavigationProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const pending = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    pending.current?.();
    pending.current = null;
  }, [path]);
  function navigate(href: string) {
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      router.push(href);
      return;
    }
    document.documentElement.dataset.sceneDirection =
      href === "/" ? "return" : "forward";
    const transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 2000);
          pending.current = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          router.push(href);
        }),
    );
    void transition.finished.catch(() => {
      /* Navigation still completes if the browser skips its visual transition. */
    });
  }
  return (
    <SceneNavigation.Provider value={navigate}>
      {children}
    </SceneNavigation.Provider>
  );
}

export function SceneLink(props: ComponentProps<typeof Link>) {
  const navigate = useContext(SceneNavigation);
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        event.preventDefault();
        navigate(String(props.href));
      }}
    />
  );
}
