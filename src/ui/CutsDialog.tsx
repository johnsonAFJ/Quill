// ••• → Cuts: the pieces you've set aside from this sheet, newest first.

import { useState } from 'react';
import { parseCuts } from '../cuts/cuts';
import { Dialog } from './Overlays';

type Props = {
  text: string;
  /** Missing while the sheet can't take text back (in Trash). */
  onPutBack?: (index: number) => void;
  onDelete: (index: number, words: number) => void;
  onClose: () => void;
};

export function CutsDialog({ text, onPutBack, onDelete, onClose }: Props) {
  const cuts = parseCuts(text);
  const [open, setOpen] = useState<number | null>(cuts[0]?.index ?? null);

  return (
    <Dialog title="Cuts" onClose={onClose}>
      {cuts.length === 0 ? (
        <p className="muted">Nothing set aside yet. Select some writing and choose “Set aside” to keep it here instead of losing it.</p>
      ) : (
        <ul className="cut-list">
          {cuts.map((cut) => (
            <li key={cut.index} className={cut.index === open ? 'open' : undefined}>
              <button className="cut-head" onClick={() => setOpen(cut.index === open ? null : cut.index)}>
                <span>{cut.when}</span>
                <small>
                  {cut.words.toLocaleString()} word{cut.words === 1 ? '' : 's'}
                </small>
              </button>
              {cut.index === open && (
                <>
                  <pre className="cut-text">{cut.text}</pre>
                  <div className="cut-actions">
                    {onPutBack && <button className="small" onClick={() => onPutBack(cut.index)}>Put back here</button>}
                    <button className="quiet small danger" onClick={() => onDelete(cut.index, cut.words)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small-print">Cuts live beside the sheet in Dropbox and never count towards your words. “Put back here” drops the piece in at your cursor.</p>
      <div className="dialog-actions">
        <button onClick={onClose}>Done</button>
      </div>
    </Dialog>
  );
}
