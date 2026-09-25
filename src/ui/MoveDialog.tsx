// "Move to…": pick the group a sheet or group should live in. On a Mac you can
// also drag it onto a group in the Library; this works everywhere, iPhone too.

import { useState } from 'react';
import type { Group, Library } from '../library/tree';
import { isWithin, parentOf } from '../sync/paths';
import { Icon } from './icons';
import { Dialog } from './Overlays';

type Props = {
  library: Library;
  /** What's moving: its path, name and whether it's a group. */
  item: { path: string; name: string; isGroup: boolean };
  onMove: (folder: string) => void;
  onClose: () => void;
};

type Place = { path: string; name: string; depth: number };

function places(group: Group, depth: number, into: Place[]) {
  for (const g of [...group.groups].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
    into.push({ path: g.path, name: g.name, depth });
    places(g, depth + 1, into);
  }
}

export function MoveDialog({ library, item, onMove, onClose }: Props) {
  const all: Place[] = [{ path: '', name: 'Inbox (top of the Library)', depth: 0 }];
  places(library.root, 0, all);
  const here = parentOf(item.path);
  // A group can't go inside itself or anything it holds.
  const allowed = (p: Place) => !(item.isGroup && p.path && isWithin(p.path, item.path));
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <Dialog title={`Move “${item.name}”`} onClose={onClose}>
      <ul className="move-list">
        {all.filter(allowed).map((p) => {
          const current = p.path.toLowerCase() === here.toLowerCase();
          return (
            <li key={p.path || '(inbox)'}>
              <button
                className={p.path === chosen ? 'on' : undefined}
                style={{ paddingLeft: `${0.6 + (p.path ? p.depth + 1 : 0) * 1}rem` }}
                disabled={current}
                onClick={() => setChosen(p.path)}
                onDoubleClick={() => !current && onMove(p.path)}
              >
                <Icon name={p.path ? 'folder' : 'inbox'} size={16} />
                <span>{p.name}</span>
                {current && <small>here now</small>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small-print">
        {item.isGroup ? 'Everything in the group moves with it.' : 'Its notes and cuts move with it.'} On a Mac you can also drag it onto a group in the Library.
      </p>
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Cancel
        </button>
        <button disabled={chosen === null} onClick={() => chosen !== null && onMove(chosen)}>
          Move
        </button>
      </div>
    </Dialog>
  );
}
