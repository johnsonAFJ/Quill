import { prefs } from '../app/device';
import { quoteOfDay, seasonNow, type SeasonChoice } from '../app/season';
import type { Group, Library } from '../library/tree';
import type { SyncStatus } from '../sync/engine';
import { Icon, type IconName } from './icons';

export const INBOX = '';
export const TRASH_VIEW = '__trash';
export const ALL_VIEW = '__all';
export const RECENT_VIEW = '__recent';
export const PROMPTS_VIEW = '__prompts';
export const SEARCH_VIEW = '__search';
/** Library rows that aren't a group (folder) of their own. */
export const SPECIAL_VIEWS = [TRASH_VIEW, ALL_VIEW, RECENT_VIEW, PROMPTS_VIEW, SEARCH_VIEW];

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
};

export function LibraryPane({ library, selected, collapsed, status, recentCount, promptsLeft, onSelect, onToggle, onNewGroup, onSettings }: Props) {
  const trashCount = library.trash.length + library.trashGroups.length;
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
        <Row icon="inbox" label="Inbox" count={library.root.sheets.length} active={selected === INBOX} onClick={() => onSelect(INBOX)} />
        <Row icon="stack" label="All" count={library.sheets.size} active={selected === ALL_VIEW} onClick={() => onSelect(ALL_VIEW)} />
        <Row icon="clock" label="Last 7 Days" count={recentCount} active={selected === RECENT_VIEW} onClick={() => onSelect(RECENT_VIEW)} />
        <Row icon="sparkle" label="Prompts" count={promptsLeft ?? 0} active={selected === PROMPTS_VIEW} onClick={() => onSelect(PROMPTS_VIEW)} />
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
        <SeasonQuote />
        <Row icon="trash" label="Trash" count={trashCount} active={selected === TRASH_VIEW} onClick={() => onSelect(TRASH_VIEW)} />
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

function Row({ icon, label, count, active, onClick }: { icon: IconName; label: string; count: number; active: boolean; onClick: () => void }) {
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
