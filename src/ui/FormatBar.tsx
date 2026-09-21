// The formatting toolbar. On Mac and iPad it sits above the text; on iPhone
// it rides just above the on-screen keyboard while you're typing.

import { useEffect, useState, type RefObject } from 'react';
import type { StateCommand } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { bold, bulletList, insertLink, italic, quote, toggleHeading } from '../editor/formatting';

const BUTTONS: { label: string; title: string; command: StateCommand; className?: string }[] = [
  { label: 'B', title: 'Bold (⌘B)', command: bold, className: 'fmt-bold' },
  { label: 'I', title: 'Italic (⌘I)', command: italic, className: 'fmt-italic' },
  { label: 'H1', title: 'Heading 1 (⌘1)', command: toggleHeading(1) },
  { label: 'H2', title: 'Heading 2 (⌘2)', command: toggleHeading(2) },
  { label: 'H3', title: 'Heading 3 (⌘3)', command: toggleHeading(3) },
  { label: '❝', title: 'Quote (⌘\')', command: quote },
  { label: '•', title: 'List (⌘⇧8)', command: bulletList },
  { label: 'Link', title: 'Link (⌘K)', command: insertLink },
];

type Props = { viewRef: RefObject<EditorView | null>; floating: boolean };

export function FormatBar({ viewRef, floating }: Props) {
  const keyboardOffset = useKeyboardOffset(floating);
  return (
    <div className={`format-bar${floating ? ' floating' : ''}`} style={floating ? { bottom: keyboardOffset } : undefined} role="toolbar" aria-label="Formatting">
      {BUTTONS.map((b) => (
        <button
          key={b.title}
          className={b.className}
          title={b.title}
          aria-label={b.title}
          // Keep the keyboard up and the selection intact.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            const view = viewRef.current;
            if (!view) return;
            b.command(view);
            view.focus();
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

/** How far the on-screen keyboard pushes up from the bottom of the window. */
function useKeyboardOffset(active: boolean): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return offset;
}
