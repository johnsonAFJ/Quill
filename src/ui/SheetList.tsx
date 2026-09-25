import type { Sheet, SortOrder, TrashedGroup } from '../library/tree';
import { isTouch } from '../app/device';
import { startDrag, useLongPress } from './drag';
import { Icon } from './icons';
import { MenuButton, type MenuItem } from './Overlays';

type Props = {
  title: string;
  sheets: Sheet[];
  selectedKey: string | null;
  sort: SortOrder;
  onSort: (order: SortOrder) => void;
  onOpen: (key: string) => void;
  /** Press and hold on a touch screen: pick the sheet up to move it. */
  onMove?: (key: string) => void;
  onBack?: () => void;
  /** Absent in Trash, where nothing new is made. */
  onNew?: () => void;
  /** A new sheet that starts with a writing prompt. */
  onPrompt?: () => void;
  /** In All and Last 7 Days: which group each sheet is in. */
  whereOf?: (path: string) => string;
  menu?: MenuItem[];
  trash?: { groups: TrashedGroup[]; onRestore: (key: string) => void; onDelete: (key: string, name: string) => void };
  /** Keys of sheets with changes that haven't reached Dropbox. */
  unsynced: Set<string>;
};

export function SheetList({ title, sheets, selectedKey, sort, onSort, onOpen, onMove, onBack, onNew, onPrompt, whereOf, menu, trash, unsynced }: Props) {
  const hold = useLongPress((key) => onMove?.(key));
  const empty = sheets.length === 0 && (trash?.groups.length ?? 0) === 0;
  return (
    <section className="pane sheet-pane" aria-label={title}>
      <header className="pane-header">
        <div className="pane-tools">
          {onBack ? (
            <button className="icon-button back" aria-label="Library" onClick={onBack}>
              <Icon name="back" /> <span>Library</span>
            </button>
          ) : (
            <span />
          )}
          <button
            className="icon-button"
            aria-label={sort === 'edited' ? 'Sorted by last edited. Sort by name' : 'Sorted by name. Sort by last edited'}
            title={sort === 'edited' ? 'Sorted by last edited' : 'Sorted by name'}
            onClick={() => onSort(sort === 'edited' ? 'name' : 'edited')}
          >
            <Icon name="sort" />
          </button>
          {onPrompt && (
            <button className="icon-button" aria-label="New sheet from a prompt" title="New sheet from a prompt" onClick={onPrompt}>
              <Icon name="sparkle" />
            </button>
          )}
          {onNew && (
            <button className="icon-button" aria-label="New sheet" onClick={onNew}>
              <Icon name="plus" />
            </button>
          )}
          {menu && <MenuButton items={menu} label="Group actions" />}
        </div>
        <h1>{title}</h1>
        <div className="sort-label">{sort === 'edited' ? 'Last edited' : 'By name'}</div>
      </header>

      <div className="pane-body sheet-cards">
        {empty && <p className="hint">{trash ? 'Trash is empty.' : 'No sheets yet. Tap + to start one.'}</p>}
        {trash?.groups.map((g) => (
          <div key={g.key} className="sheet-card trashed-group">
            <div className="card-title">
              <Icon name="folder" size={16} /> {g.name}
            </div>
            <div className="card-preview">
              Group with {g.sheetCount} sheet{g.sheetCount === 1 ? '' : 's'}
            </div>
            <div className="trash-actions">
              <button className="quiet small" onClick={() => trash.onRestore(g.key)}>
                Put back
              </button>
              <button className="quiet small danger" onClick={() => trash.onDelete(g.key, g.name)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {sheets.map((s) => (
          <div
            key={s.key}
            className={`sheet-card${s.key === selectedKey ? ' active' : ''}`}
            draggable={!trash && !isTouch()}
            onDragStart={(e) => startDrag(e, s.key)}
            {...(!trash && onMove && isTouch() ? hold(s.key) : {})}
          >
            <button className="card-main" onClick={() => onOpen(s.key)}>
              <div className="card-title">
                {unsynced.has(s.key) && <span className="dot" aria-label="Not synced yet" />}
                <span className="card-name">{s.title || 'New sheet'}</span>
                {s.hasNotes && (
                  <span className="card-clip" aria-label="Has notes">
                    <Icon name="paperclip" size={14} />
                  </span>
                )}
              </div>
              {whereOf && <div className="card-where">{whereOf(s.path)}</div>}
              {s.preview && <div className="card-preview">{s.preview}</div>}
              {(s.conflicts.length > 0 || /\(conflict, /.test(s.name)) && <div className="badge">Conflict</div>}
            </button>
            {trash && (
              <div className="trash-actions">
                <button className="quiet small" onClick={() => trash.onRestore(s.key)}>
                  Put back
                </button>
                <button className="quiet small danger" onClick={() => trash.onDelete(s.key, s.title)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
