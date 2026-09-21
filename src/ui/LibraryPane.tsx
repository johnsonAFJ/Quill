import type { Group, Library } from '../library/tree';
import type { SyncStatus } from '../sync/engine';
import { Icon } from './icons';

export const INBOX = '';
export const TRASH_VIEW = '__trash';

type Props = {
  library: Library;
  selected: string;
  collapsed: Set<string>;
  status: SyncStatus;
  onSelect: (groupKey: string) => void;
  onToggle: (groupKey: string) => void;
  onNewGroup: () => void;
  onSettings: () => void;
};

export function LibraryPane({ library, selected, collapsed, status, onSelect, onToggle, onNewGroup, onSettings }: Props) {
  const trashCount = library.trash.length + library.trashGroups.length;
  return (
    <nav className="pane library-pane" aria-label="Library">
      <header className="pane-header">
        <div className="pane-tools">
          <span />
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
        <Row icon="inbox" label="Inbox" count={library.root.sheets.length} active={selected === INBOX} onClick={() => onSelect(INBOX)} />
        {library.root.groups.length > 0 && <div className="section-label">Groups</div>}
        {sortGroups(library.root.groups).map((g) => (
          <GroupRow key={g.key} group={g} depth={0} selected={selected} collapsed={collapsed} onSelect={onSelect} onToggle={onToggle} />
        ))}
        {library.root.groups.length === 0 && (
          <p className="hint">
            Groups are folders in Dropbox. Tap <strong>+</strong> to make one.
          </p>
        )}
        <div className="library-spacer" />
        <Row icon="trash" label="Trash" count={trashCount} active={selected === TRASH_VIEW} onClick={() => onSelect(TRASH_VIEW)} />
      </div>

      <footer className="sync-line">
        <SyncLine status={status} />
      </footer>
    </nav>
  );
}

function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function Row({ icon, label, count, active, onClick }: { icon: 'inbox' | 'trash'; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button className={`library-row${active ? ' active' : ''}`} onClick={onClick}>
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
};

function GroupRow({ group, depth, selected, collapsed, onSelect, onToggle }: GroupRowProps) {
  const hasChildren = group.groups.length > 0;
  const open = !collapsed.has(group.key);
  return (
    <>
      <div className={`library-row${selected === group.key ? ' active' : ''}`} style={{ paddingLeft: `${0.25 + depth * 1.1}rem` }}>
        {hasChildren ? (
          <button className="row-lead disclosure" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => onToggle(group.key)}>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
        ) : (
          <span className="row-lead" />
        )}
        <button className="row-main" onClick={() => onSelect(group.key)}>
          <Icon name="folder" />
          <span className="row-label">{group.name}</span>
          {group.sheets.length > 0 && <span className="row-count">{group.sheets.length}</span>}
        </button>
      </div>
      {hasChildren &&
        open &&
        sortGroups(group.groups).map((g) => (
          <GroupRow key={g.key} group={g} depth={depth + 1} selected={selected} collapsed={collapsed} onSelect={onSelect} onToggle={onToggle} />
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
