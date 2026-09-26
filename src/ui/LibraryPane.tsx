import { prefs } from '../app/device';
import { quoteOfDay, seasonNow, type SeasonChoice } from '../app/season';
import type { Group, Library } from '../library/tree';
import type { SyncStatus } from '../sync/engine';
import { useState, type DragEvent } from 'react';
import { draggedKeys, isQuillDrag, startDrag, useLongPress } from './drag';
import { isTouch } from '../app/device';
import { Icon, type IconName } from './icons';

export const INBOX = '';
export const TRASH_VIEW = '__trash';
export const ALL_VIEW = '__all';
export const RECENT_VIEW = '__recent';
export const PROMPTS_VIEW = '__prompts';
export const SEARCH_VIEW = '__search';
export const LOG_VIEW = '__log';
/** Library rows that aren't a group (folder) of their own. */
export const SPECIAL_VIEWS = [TRASH_VIEW, ALL_VIEW, RECENT_VIEW, PROMPTS_VIEW, SEARCH_VIEW, LOG_VIEW];

type Props = {
  library: Library;
  selected: string;
  collapsed: Set<string>;
  status: SyncStatus;
  recentCount: number;
  /** Prompts left on your list, or null before the list exists. */
  promptsLeft: number | null;
  onSelect: (groupKey: string) => void;
  onToggle: (groupKey: string) => void;
  onNewGroup: () => void;
  onSettings: () => void;
  /** Sheets or groups dropped on a group ("" for the Inbox, the top of the Library). */
  onDropItems?: (keys: string[], folder: string) => void;
  /** Sheets or groups dropped on Trash. */
  onTrashItems?: (keys: string[]) => void;
  /** Groups picked with ⌘-click, to move or trash with the selection. */
  picked?: Set<string>;
  onPick?: (key: string) => void;
  dragKeys?: (key: string) => string[];
  /** Press and hold a group on a touch screen: pick it up to move it. */
  onMoveGroup?: (key: string) => void;
};

export function LibraryPane({ library, selected, collapsed, status, recentCount, promptsLeft, onSelect, onToggle, onNewGroup, onSettings, onDropItems, onTrashItems, picked, onPick, dragKeys, onMoveGroup }: Props) {
  const hold = useLongPress((key) => onMoveGroup?.(key));
  const holdGroup = onMoveGroup && isTouch() ? hold : undefined;
  const trashCount = library.trash.length + library.trashGroups.length;
  const [over, setOver] = useState<string | null>(null);
  /** Makes a row a place to drop things. `spot` names it for the highlight; `land` does the moving. */
  const dropHandlers = (spot: string, land: ((keys: string[]) => void) | undefined): DropHandlers =>
    land
      ? {
          onDragOver: (e: DragEvent) => {
            if (!isQuillDrag(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOver(spot);
          },
          onDragLeave: () => setOver((o) => (o === spot ? null : o)),
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            setOver(null);
            const keys = draggedKeys(e);
            if (keys.length) land(keys);
          },
        }
      : {};
  const dropTarget = (folder: string) => dropHandlers(folder, onDropItems && ((keys) => onDropItems(keys, folder)));
  const TRASH_SPOT = '\u0000trash';
  return (
    <nav className="pane library-pane" aria-label="Library">
      <header className="pane-header">
        <div className="pane-tools">
          <span />
          <button className={`icon-button${selected === SEARCH_VIEW ? ' on' : ''}`} aria-label="Search" title="Search everything (⌥⌘F)" onClick={() => onSelect(SEARCH_VIEW)}>
            <Icon name="search" />
          </button>
          <button className="icon-button" aria-label="New group" onClick={onNewGroup}>
            <Icon name="plus" />
          </button>
          <button className="icon-button" aria-label="Settings" onClick={onSettings}>
            <Icon name="gear" />
          </button>
        </div>
        <h1>Library</h1>
      </header>

      <div className="pane-body">
        <Row icon="inbox" label="Inbox" count={library.root.sheets.length} active={selected === INBOX} onClick={() => onSelect(INBOX)} dropOver={over === ''} drop={dropTarget('')} />
        <Row icon="stack" label="All" count={library.sheets.size} active={selected === ALL_VIEW} onClick={() => onSelect(ALL_VIEW)} />
        <Row icon="clock" label="Last 7 Days" count={recentCount} active={selected === RECENT_VIEW} onClick={() => onSelect(RECENT_VIEW)} />
        <Row icon="sparkle" label="Prompts" count={promptsLeft ?? 0} active={selected === PROMPTS_VIEW} onClick={() => onSelect(PROMPTS_VIEW)} />
        <Row icon="calendar" label="Writing log" active={selected === LOG_VIEW} onClick={() => onSelect(LOG_VIEW)} />
        {library.root.groups.length > 0 && <div className="section-label">Groups</div>}
        {sortGroups(library.root.groups).map((g) => (
          <GroupRow key={g.key} group={g} depth={0} selected={selected} collapsed={collapsed} onSelect={onSelect} onToggle={onToggle} over={over} dropTarget={dropTarget} draggable={Boolean(onDropItems)} hold={holdGroup} picked={picked} onPick={onPick} dragKeys={dragKeys} />
        ))}
        {library.root.groups.length === 0 && (
          <p className="hint">
            Groups are folders in Dropbox. Tap <strong>+</strong> to make one.
          </p>
        )}
        <div className="library-spacer" />
        <SeasonQuote />
        <Row icon="trash" label="Trash" count={trashCount} active={selected === TRASH_VIEW} onClick={() => onSelect(TRASH_VIEW)} dropOver={over === TRASH_SPOT} drop={dropHandlers(TRASH_SPOT, onTrashItems)} />
      </div>

      <footer className="sync-line">
        <SyncLine status={status} />
      </footer>
    </nav>
  );
}

/** While a season is on, one line a day from a book old enough to be out of copyright. */
function SeasonQuote() {
  const today = new Date();
  const season = seasonNow(today, prefs.get<SeasonChoice>('season', 'auto'), prefs.get<string[]>('seasonsSkipped', []));
  const quote = season && quoteOfDay(season, today);
  if (!quote) return null;
  return (
    <figure className="season-quote">
      <blockquote>“{quote.line}”</blockquote>
      <figcaption>{quote.from}</figcaption>
    </figure>
  );
}

function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

type DropHandlers = { onDragOver?: (e: DragEvent) => void; onDragLeave?: () => void; onDrop?: (e: DragEvent) => void };

function Row({ icon, label, count = 0, active, onClick, dropOver, drop }: { icon: IconName; label: string; count?: number; active: boolean; onClick: () => void; dropOver?: boolean; drop?: DropHandlers }) {
  return (
    <button className={`library-row${active ? ' active' : ''}${dropOver ? ' drop-over' : ''}`} onClick={onClick} {...drop}>
      <span className="row-lead" />
      <Icon name={icon} />
      <span className="row-label">{label}</span>
      {count > 0 && <span className="row-count">{count}</span>}
    </button>
  );
}

type GroupRowProps = {
  group: Group;
  depth: number;
  selected: string;
  collapsed: Set<string>;
  onSelect: (key: string) => void;
  onToggle: (key: string) => void;
  /** The folder a drag is hovering over, to light that row up. */
  over: string | null;
  dropTarget: (folder: string) => DropHandlers;
  draggable: boolean;
  hold?: ReturnType<typeof useLongPress>;
  picked?: Set<string>;
  onPick?: (key: string) => void;
  dragKeys?: (key: string) => string[];
};

function GroupRow({ group, depth, selected, collapsed, onSelect, onToggle, over, dropTarget, draggable, hold, picked, onPick, dragKeys }: GroupRowProps) {
  const hasChildren = group.groups.length > 0;
  const open = !collapsed.has(group.key);
  return (
    <>
      <div
        className={`library-row${selected === group.key ? ' active' : ''}${over === group.path ? ' drop-over' : ''}${picked?.has(group.key) ? ' picked' : ''}`}
        style={{ paddingLeft: `${0.25 + depth * 1.1}rem` }}
        draggable={draggable}
        onDragStart={(e) => startDrag(e, dragKeys ? dragKeys(group.key) : [group.key])}
        {...dropTarget(group.path)}
        {...(hold ? hold(group.key) : {})}
      >
        {hasChildren ? (
          <button className="row-lead disclosure" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => onToggle(group.key)}>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
        ) : (
          <span className="row-lead" />
        )}
        <button className="row-main" onClick={(e) => (onPick && (e.metaKey || e.ctrlKey) ? onPick(group.key) : onSelect(group.key))}>
          <Icon name="folder" />
          <span className="row-label">{group.name}</span>
          {group.sheets.length > 0 && <span className="row-count">{group.sheets.length}</span>}
        </button>
      </div>
      {hasChildren &&
        open &&
        sortGroups(group.groups).map((g) => (
          <GroupRow key={g.key} group={g} depth={depth + 1} selected={selected} collapsed={collapsed} onSelect={onSelect} onToggle={onToggle} over={over} dropTarget={dropTarget} draggable={draggable} hold={hold} picked={picked} onPick={onPick} dragKeys={dragKeys} />
        ))}
    </>
  );
}

export function SyncLine({ status }: { status: SyncStatus }) {
  if (status.error) {
    const saved = status.pending > 0 ? ` · ${status.pending} change${status.pending === 1 ? '' : 's'} saved on this device` : '';
    return (
      <span className="sync-state warn" title={status.error}>
        <span className="dot" /> {status.offline ? 'Offline' : 'Sync problem (see Settings)'}
        {saved}
      </span>
    );
  }
  if (status.syncing) return <span className="sync-state">Syncing…</span>;
  if (status.pending > 0) {
    return (
      <span className="sync-state">
        <span className="dot" /> {status.pending} change{status.pending === 1 ? '' : 's'} waiting to sync
      </span>
    );
  }
  return <span className="sync-state">All changes synced</span>;
}
