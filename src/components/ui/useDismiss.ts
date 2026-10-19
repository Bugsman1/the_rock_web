import { useEffect } from "react";
import type { RefObject } from "react";

export function useDismiss(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && container.current?.contains(target) !== true) {
        close();
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, container, close]);
}
