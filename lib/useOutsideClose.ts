"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close an open popover when the pointer goes down anywhere outside it.
 *
 * Bound on mousedown rather than click: a click fires after the button underneath has
 * already reacted, which makes a menu that overlaps another control feel like it swallowed
 * the first press. The listener is only attached while something is open, so a page full of
 * closed dropdowns costs nothing.
 */
export function useOutsideClose(open: boolean, ref: RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, ref, close]);
}
