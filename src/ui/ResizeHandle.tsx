// A thin strip on a column's edge. Drag it to change the column's width;
// double-click it to go back to the usual width.

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
