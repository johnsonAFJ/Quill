// Dragging sheets and groups onto groups in the Library (Mac and iPad).
// The payload is just the item's key; the Workspace does the moving.

import { useRef, type DragEvent, type MouseEvent, type TouchEvent } from 'react';

const TYPE = 'application/x-quill-item';

export function startDrag(e: DragEvent, key: string): void {
  e.dataTransfer.setData(TYPE, key);
  e.dataTransfer.effectAllowed = 'move';
}

/** The key being dragged, or null for anything that isn't from Quill (a file from Finder, say). */
export function draggedKey(e: DragEvent): string | null {
  return e.dataTransfer.getData(TYPE) || null;
}

export const isQuillDrag = (e: DragEvent): boolean => e.dataTransfer.types.includes(TYPE);

/**
 * Press and hold on a touch screen, the iPhone's way of picking something up.
 * Moving your finger first (scrolling) cancels it, and the tap that ends a
 * long press doesn't also open the thing underneath.
 */
export function useLongPress(onLongPress: (key: string) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (key: string) => ({
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]!;
      start.current = { x: t.clientX, y: t.clientY };
      fired.current = false;
      cancel();
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress(key);
      }, ms);
    },
    onTouchMove: (e: TouchEvent) => {
      const t = e.touches[0]!;
      if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 10) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  });
}
