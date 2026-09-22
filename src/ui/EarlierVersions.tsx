// ••• → Earlier versions: the snapshots of this sheet saved on this device.

import { useEffect, useState } from 'react';
import type { Snapshot, Snapshots } from '../sync/snapshots';
import { Dialog } from './Overlays';

type Props = { fileId: string; snapshots: Snapshots; onRestore: (text: string) => void; onClose: () => void };

function when(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${time}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

export function EarlierVersions({ fileId, snapshots, onRestore, onClose }: Props) {
  const [list, setList] = useState<Snapshot[] | null>(null);
  const [chosen, setChosen] = useState<Snapshot | null>(null);

  useEffect(() => {
    snapshots.list(fileId).then((all) => {
      setList(all);
      setChosen(all[0] ?? null);
    });
  }, [fileId, snapshots]);

  return (
    <Dialog title="Earlier versions" onClose={onClose}>
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No earlier versions yet. Quill saves one on this device each time you start working on a sheet.</p>
      ) : (
        <div className="versions">
          <ul className="version-list">
            {list.map((s) => (
              <li key={s.id}>
                <button className={s.id === chosen?.id ? 'on' : ''} onClick={() => setChosen(s)}>
                  <span>{when(s.at)}</span>
                  <small>
                    {s.words.toLocaleString()} words{s.why === 'before restore' ? ' · before a restore' : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {chosen && <pre className="version-preview">{chosen.text}</pre>}
        </div>
      )}
      <p className="muted small-print">Kept on this device only: the last 20 for each sheet.</p>
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Close
        </button>
        <button
          disabled={!chosen}
          onClick={() => {
            if (chosen && confirm(`Replace this sheet with the version from ${when(chosen.at)}? The current text is saved as a version first, so you can undo this.`)) {
              onRestore(chosen.text);
              onClose();
            }
          }}
        >
          Restore this version
        </button>
      </div>
    </Dialog>
  );
}
