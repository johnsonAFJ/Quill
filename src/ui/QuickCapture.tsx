// ⌘⇧J: jot a thought without leaving what you're writing.

import { useState } from 'react';
import { Dialog } from './Overlays';

type Props = { onSave: (note: string) => void; onClose: () => void };

export function QuickCapture({ onSave, onClose }: Props) {
  const [text, setText] = useState('');
  const save = () => {
    if (text.trim()) onSave(text);
    onClose();
  };
  return (
    <Dialog title="Quick note" onClose={onClose}>
      <textarea
        className="quick-capture"
        autoFocus
        rows={4}
        value={text}
        placeholder="Whatever’s on your mind…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Return saves; Shift-Return starts a new line.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
      />
      <p className="muted small-print">Added to the bottom of “Quick Notes” in your Inbox. Return to save, Shift-Return for a new line.</p>
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Cancel
        </button>
        <button onClick={save} disabled={!text.trim()}>
          Add note
        </button>
      </div>
    </Dialog>
  );
}
