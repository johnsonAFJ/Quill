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
  /** Sheets (and groups) picked to move or trash together. */
  picked?: Set<string>;
  /** ⌘-click (or a tap while selecting) toggles one; ⇧-click picks everything between. */
  onPick?: (key: string, how: 'toggle' | 'range') => void;
  /** Tapping picks instead of opening: the "Select" button, for touch screens especially. */
  selecting?: boolean;
  onToggleSelecting?: () => void;
  /** What a drag carries: the whole selection when the dragged sheet is part of it. */
  dragKeys?: (key: string) => string[];
};

export function SheetList({ title, sheets, selectedKey, sort, onSort, onOpen, onMove, onBack, onNew, onPrompt, whereOf, menu, trash, unsynced, picked, onPick, selecting = false, onToggleSelecting, dragKeys }: Props) {
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
          {onToggleSelecting && !trash && sheets.length > 0 && (
            <button className={`icon-button select-toggle${selecting ? ' on' : ''}`} aria-pressed={selecting} title="Pick several sheets to move or trash (⌘-click works too)" onClick={onToggleSelecting}>
              {selecting ? 'Done' : 'Select'}
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
            className={`sheet-card${s.key === selectedKey && !selecting ? ' active' : ''}${picked?.has(s.key) ? ' picked' : ''}${selecting ? ' selecting' : ''}`}
            draggable={!trash && !isTouch()}
            onDragStart={(e) => startDrag(e, dragKeys ? dragKeys(s.key) : [s.key])}
            {...(!trash && onMove && isTouch() && !selecting ? hold(s.key) : {})}
          >
            <button
              className="card-main"
              aria-pressed={selecting ? Boolean(picked?.has(s.key)) : undefined}
              onClick={(e) => {
                if (trash || !onPick) return onOpen(s.key);
                if (selecting || e.metaKey || e.ctrlKey) onPick(s.key, 'toggle');
                else if (e.shiftKey) onPick(s.key, 'range');
                else onOpen(s.key);
              }}
            >
              {selecting && (
                <span className="card-tick" aria-hidden="true">
                  {picked?.has(s.key) && <Icon name="check" size={12} />}
                </span>
              )}
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
