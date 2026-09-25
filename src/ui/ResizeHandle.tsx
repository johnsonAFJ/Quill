// A thin strip on a column's edge. Drag it to change the column's width;
// double-click it to go back to the usual width. `SplitHandle` does the same
// job lying down, between two panels stacked in one column.

import { useRef } from 'react';

type Props = {
  /** Which edge of the column the strip sits on. */
  edge: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onReset: () => void;
};

export function ResizeHandle({ edge, width, min, max, onResize, onReset }: Props) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  return (
    <div
      className={`resize-handle ${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize. Double-click to reset."
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, width };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = (e.clientX - drag.current.x) * (edge === 'right' ? 1 : -1);
        onResize(Math.round(Math.min(max, Math.max(min, drag.current.width + dx))));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={onReset}
    />
  );
}

type SplitProps = {
  /** How much of the height the panel above takes, 20–80. */
  share: number;
  onResize: (share: number) => void;
  onReset: () => void;
};

export function SplitHandle({ share, onResize, onReset }: SplitProps) {
  const drag = useRef<{ y: number; share: number; height: number } | null>(null);
  return (
    <div
      className="split-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drag to resize. Double-click to reset."
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, share, height: e.currentTarget.parentElement?.clientHeight || window.innerHeight };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const moved = ((e.clientY - drag.current.y) / drag.current.height) * 100;
        onResize(Math.round(Math.min(80, Math.max(20, drag.current.share + moved))));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={onReset}
    />
  );
}
