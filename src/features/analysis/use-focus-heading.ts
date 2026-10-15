"use client";
import { useEffect, useRef } from "react";

/** Move focus to the screen's h1 when it mounts so screen readers land on the new content. */
export function useFocusHeading() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return heading;
}
