// The writing app: Library → sheet list → editor, arranged for the screen size.
//   Mac and iPad landscape: three columns.
//   iPad portrait: sheet list and editor, with the Library sliding in.
//   iPhone: one screen at a time.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type TouchEvent } from 'react';
import { isTouch, prefs } from '../app/device';
import { buildLibrary, sortSheets, type SortOrder } from '../library/tree';
import type { Engine } from '../sync/engine';
import { TRASH, isWithin, keyOf, parentOf } from '../sync/paths';
import { EditorPane } from './EditorPane';
import { INBOX, LibraryPane, TRASH_VIEW } from './LibraryPane';
import { NameDialog, type MenuItem, type NameRequest } from './Overlays';
import { SettingsDialog } from './SettingsDialog';
import { SheetList } from './SheetList';

type Layout = 'wide' | 'medium' | 'narrow';
type Pane = 'library' | 'sheets' | 'editor';

const SYNC_AFTER_CHANGE_MS = 2000;
const SYNC_RETRY_MS = 15_000;
const SYNC_EVERY_MS = 60_000;

function useLayout(): Layout {
  const measure = (): Layout => (window.innerWidth >= 1100 ? 'wide' : window.innerWidth >= 700 ? 'medium' : 'narrow');
  const [layout, setLayout] = useState(measure);
  useEffect(() => {
    const onResize = () => setLayout(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return layout;
}

/** Keeps a value in per-device preferences. */
function usePref<T>(name: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => prefs.get(name, fallback));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      prefs.set(name, v);
    },
    [name],
  );
  return [value, set];
}

type Props = { engine: Engine; onDisconnect: () => void };

export function Workspace({ engine, onDisconnect }: Props) {
  const revision = useSyncExternalStore(
    useCallback((listener: () => void) => engine.subscribe(listener), [engine]),
    () => engine.getRevision(),
  );
  const layout = useLayout();
  const touch = useMemo(isTouch, []);

  const library = useMemo(
    () =>
      buildLibrary(
        engine.all().map((f) => ({
          kind: f.kind,
          path: f.path,
          key: f.key,
          text: f.text,
          modified: Math.max(f.localModified ?? 0, f.serverModified ? Date.parse(f.serverModified) : 0),
        })),
      ),
    // Rebuilt whenever the engine reports a change.
    [engine, revision],
  );
  const unsynced = useMemo(() => new Set(engine.all().filter((f) => f.dirty).map((f) => f.key)), [engine, revision]);

  // ---- What's showing ----
  const [groupKey, setGroupKey] = usePref<string>('group', INBOX);
  const [sheetKey, setSheetKey] = usePref<string | null>('sheet', null);
  const [pane, setPane] = useState<Pane>(() => (prefs.get<string | null>('sheet', null) ? 'editor' : 'sheets'));
  const [focusMode, setFocusMode] = usePref('focus', false);
  const [showWords, setShowWords] = usePref('words', false);
  const [sort, setSort] = usePref<SortOrder>('sort', 'edited');
  const [collapsedList, setCollapsedList] = usePref<string[]>('collapsed', []);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);

  const group = groupKey === TRASH_VIEW ? null : (library.groups.get(groupKey) ?? library.root);
  const inTrash = groupKey === TRASH_VIEW;
  const sheet = sheetKey ? engine.get(sheetKey) : undefined;
  const currentKey = sheet?.kind === 'file' ? sheet.key : null;
  const readOnly = sheet ? isWithin(sheet.path, TRASH) : false;

  // A group that no longer exists (deleted on another device): fall back to Inbox.
  useEffect(() => {
    if (groupKey !== TRASH_VIEW && groupKey !== INBOX && !library.groups.has(groupKey)) setGroupKey(INBOX);
  }, [groupKey, library, setGroupKey]);

  // ---- Syncing ----
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    void engine.sync();
    const tick = setInterval(() => document.visibilityState === 'visible' && engine.sync(), SYNC_EVERY_MS);
    // Opening the app, switching back to it, leaving it, and getting a signal back.
    const syncNow = () => void engine.sync();
    document.addEventListener('visibilitychange', syncNow);
    window.addEventListener('online', syncNow);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', syncNow);
      window.removeEventListener('online', syncNow);
    };
  }, [engine]);

  // Any change made here (typing, new groups, renames, Trash) is sent a moment
  // later.
  // After a failed sync, try again a little later.
  useEffect(() => {
    const { pending, syncing, error } = engine.status;
    if (syncing || (pending === 0 && !error)) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void engine.sync(), error ? SYNC_RETRY_MS : SYNC_AFTER_CHANGE_MS);
  }, [engine, revision]);

  const onChange = (text: string) => {
    if (currentKey && !readOnly) engine.setText(currentKey, text);
  };

  // ---- Navigation ----
  /** Leaving a sheet names a new "Untitled" one from its first line. */
  const leaveSheet = (): string | null => (currentKey ? engine.finishEditing(currentKey) : null);

  const openSheet = (key: string) => {
    if (key !== currentKey) leaveSheet();
    setSheetKey(key);
    setPane('editor');
    setLibraryOpen(false);
  };

  const selectGroup = (key: string) => {
    setGroupKey(key);
    setPane('sheets');
    setLibraryOpen(false);
  };

  const backToSheets = () => {
    setSheetKey(leaveSheet());
    setPane('sheets');
  };

  const newSheet = () => {
    if (!group) return;
    const created = engine.createSheet(group.path);
    openSheet(created.key);
    setTimeout(() => document.querySelector<HTMLElement>('.cm-content')?.focus(), 50);
  };

  const askForName = (request: NameRequest) => setNameRequest(request);

  const newGroup = (parent: string) =>
    askForName({
      title: parent ? 'New group inside' : 'New group',
      initial: '',
      action: 'Create',
      onDone: (name) => {
        const created = engine.createGroup(parent, name);
        if (created) selectGroup(created.key);
      },
    });

  const toggleCollapsed = (key: string) => setCollapsedList(collapsed.has(key) ? collapsedList.filter((k) => k !== key) : [...collapsedList, key]);

  // ⌘⇧F toggles focus mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, setFocusMode]);

  // ---- Menus ----
  const groupMenu: MenuItem[] | undefined =
    group && group !== library.root
      ? [
          { label: 'New group inside…', icon: 'folder', onSelect: () => newGroup(group.path) },
          {
            label: 'Rename group…',
            onSelect: () =>
              askForName({
                title: 'Rename group',
                initial: group.name,
                action: 'Rename',
                onDone: (name) => {
                  const key = engine.rename(group.key, name);
                  if (key) setGroupKey(key);
                },
              }),
          },
          'divider',
          {
            label: 'Move group to Trash',
            icon: 'trash',
            danger: true,
            onSelect: () => {
              if (currentKey && isWithin(currentKey, group.key)) setSheetKey(null);
              engine.trash(group.key);
              setGroupKey(keyOf(parentOf(group.path)) || INBOX);
            },
          },
        ]
      : undefined;

  const sheetMenu: MenuItem[] = !sheet
    ? []
    : readOnly
      ? [
          { label: 'Put back', icon: 'restore', onSelect: () => setSheetKey(engine.restore(sheet.key)) },
          { label: 'Word count', checked: showWords, onSelect: () => setShowWords(!showWords) },
        ]
      : [
          {
            label: 'Rename…',
            onSelect: () =>
              askForName({
                title: 'Rename sheet',
                initial: library.sheets.get(sheet.key)?.name ?? '',
                action: 'Rename',
                onDone: (name) => {
                  const key = engine.rename(sheet.key, name);
                  if (key) setSheetKey(key);
                },
              }),
          },
          { label: 'Word count', checked: showWords, onSelect: () => setShowWords(!showWords) },
          ...(layout === 'narrow' ? [] : [{ label: 'Focus mode', checked: focusMode, onSelect: () => setFocusMode(!focusMode) }]),
          'divider',
          {
            label: 'Move to Trash',
            icon: 'trash',
            danger: true,
            onSelect: () => {
              engine.trash(sheet.key);
              setSheetKey(null);
              setPane('sheets');
            },
          },
        ];

  // ---- Conflict banners ----
  let banner: ReactNode = null;
  const sheetInfo = currentKey ? library.sheets.get(currentKey) : undefined;
  if (sheetInfo && sheetInfo.conflicts.length > 0) {
    banner = (
      <div className="banner">
        This sheet was changed on two devices at once, so Quill kept both versions. Compare them, then move the one you don’t want to Trash.
        <button className="quiet small" onClick={() => openSheet(sheetInfo.conflicts[0]!)}>
          Open the other version
        </button>
      </div>
    );
  } else if (sheetInfo) {
    const original = sheetInfo.name.match(/^(.*) \(conflict, /)?.[1];
    const originalKey = original && keyOf(`${parentOf(sheetInfo.path)}/${original}.md`);
    if (originalKey) {
      banner = (
        <div className="banner">
          This is a conflicting copy of “{original}”, saved when it was changed on two devices at once.
          {library.sheets.has(originalKey) && (
            <button className="quiet small" onClick={() => openSheet(originalKey)}>
              Open the original
            </button>
          )}
          <button
            className="quiet small"
            onClick={() => {
              engine.trash(sheetInfo.key);
              setSheetKey(library.sheets.has(originalKey) ? originalKey : null);
            }}
          >
            Move this copy to Trash
          </button>
        </div>
      );
    }
  }

  // ---- Panes ----
  const listTitle = inTrash ? 'Trash' : group === library.root ? 'Inbox' : (group?.name ?? '');
  const listSheets = inTrash ? sortSheets(library.trash, sort) : sortSheets(group?.sheets ?? [], sort);

  const libraryPane = (
    <LibraryPane
      library={library}
      selected={groupKey}
      collapsed={collapsed}
      status={engine.status}
      onSelect={selectGroup}
      onToggle={toggleCollapsed}
      onNewGroup={() => newGroup('')}
      onSettings={() => setSettingsOpen(true)}
    />
  );

  const sheetList = (
    <SheetList
      title={listTitle}
      sheets={listSheets}
      selectedKey={currentKey}
      sort={sort}
      onSort={setSort}
      onOpen={openSheet}
      onBack={layout === 'wide' ? undefined : layout === 'narrow' ? () => setPane('library') : () => setLibraryOpen(true)}
      onNew={inTrash ? undefined : newSheet}
      menu={groupMenu}
      unsynced={unsynced}
      trash={
        inTrash
          ? {
              groups: library.trashGroups,
              onRestore: (key) => {
                const restored = engine.restore(key);
                if (key === currentKey) setSheetKey(restored);
              },
            }
          : undefined
      }
    />
  );

  const editorPane = (
    <EditorPane
      sheetKey={currentKey}
      text={sheet?.text ?? ''}
      readOnly={readOnly}
      unsynced={currentKey ? unsynced.has(currentKey) : false}
      touch={touch}
      focusMode={focusMode && layout !== 'narrow'}
      showWords={showWords}
      menu={sheetMenu}
      banner={banner}
      onChange={onChange}
      onBack={layout === 'narrow' ? backToSheets : undefined}
      onToggleFocus={layout === 'narrow' ? undefined : () => setFocusMode(!focusMode)}
      onToggleWords={() => setShowWords(!showWords)}
    />
  );

  // iPhone: swipe in from the left edge to go back.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]!;
    swipe.current = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = swipe.current;
    const t = e.changedTouches[0]!;
    swipe.current = null;
    if (!start || t.clientX - start.x < 80 || Math.abs(t.clientY - start.y) > 60) return;
    if (pane === 'editor') backToSheets();
    else if (pane === 'sheets') setPane('library');
  };

  return (
    <div className={`workspace ${layout}${focusMode && layout !== 'narrow' ? ' focus' : ''}`} onTouchStart={layout === 'narrow' ? onTouchStart : undefined} onTouchEnd={layout === 'narrow' ? onTouchEnd : undefined}>
      {layout === 'narrow' ? (
        pane === 'library' ? libraryPane : pane === 'sheets' || !currentKey ? sheetList : editorPane
      ) : (
        <>
          {layout === 'wide' && !focusMode && libraryPane}
          {!focusMode && sheetList}
          {editorPane}
          {layout === 'medium' && libraryOpen && (
            <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setLibraryOpen(false)}>
              <div className="drawer">{libraryPane}</div>
            </div>
          )}
        </>
      )}
      {nameRequest && <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />}
      {settingsOpen && <SettingsDialog engine={engine} onDisconnect={onDisconnect} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
