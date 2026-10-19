"use client";

import { useCallback, useLayoutEffect, useState } from "react";

type ScrollRequest = { revision: number; route: string; anchor?: string | null };

export function readPageAnchor(): string | null {
  try { return decodeURIComponent(window.location.hash.slice(1)) || null; }
  catch { return null; }
}

/** An immediate route reset must not inherit the site's smooth anchor scrolling. */
export function scrollToPageStart(anchor: string | null = null): void {
  const root = document.documentElement;
  const behavior = root.style.getPropertyValue("scroll-behavior");
  const priority = root.style.getPropertyPriority("scroll-behavior");
  root.style.setProperty("scroll-behavior", "auto", "important");
  try {
    const destination = anchor ? document.getElementById(anchor) : null;
    if (destination) destination.scrollIntoView({ block: "start", behavior: "auto" });
    else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } finally {
    if (behavior) root.style.setProperty("scroll-behavior", behavior, priority);
    else root.style.removeProperty("scroll-behavior");
  }
}

/** Runs once per committed navigation, never again just because a model or photo loads. */
export function usePageScroll(): (anchor?: string | null) => void {
  const [request, setRequest] = useState<ScrollRequest>({ revision: 0, route: "initial" });

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.history.scrollRestoration = "manual";
        scrollToPageStart(readPageAnchor());
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    // React has now replaced the old page. This also handles same-page and
    // product-to-product navigation, because each request has its own revision.
    scrollToPageStart(request.anchor === undefined ? readPageAnchor() : request.anchor);
  }, [request]);

  return useCallback((anchor: string | null = null) => {
    const route = window.location.pathname + window.location.search;
    setRequest(previous => ({ revision: previous.revision + 1, route, anchor }));
  }, []);
}
