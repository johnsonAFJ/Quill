// The writing app: Library → sheet list → editor, arranged for the screen size.
//   Mac and iPad landscape: three columns.
//   iPad portrait: sheet list and editor, with the Library sliding in.
//   iPhone: one screen at a time.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type TouchEvent } from 'react';
import { openSearchPanel } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import { markUpdatesSeen, unseenUpdates, updates } from '../app/changelog';
import { isTouch, prefs } from '../app/device';
import { search, whereOf, type SearchHit } from '../library/search';
import { buildLibrary, sortSheets, type SortOrder } from '../library/tree';
import { wordCount } from '../text/markdown';
import type { Engine } from '../sync/engine';
import type { Snapshots } from '../sync/snapshots';
import { parseNotes, pinnedNote, togglePin } from '../notes/notes';
import { QUICK_NOTES_PATH, appendQuickNote } from '../notes/quickNotes';
import { PROMPTS_PATH, markUsed, mergeBatches, newPromptFile, pickPrompt, promptComment, unusedPrompts, usedCount } from '../prompts/prompts';
import { PROMPT_BATCHES } from '../prompts/starter';
import { TRASH, isWithin, keyOf, notesPathFor, parentOf } from '../sync/paths';
import { EarlierVersions } from './EarlierVersions';
import { EditorPane } from './EditorPane';
import { ExportPdf } from './ExportPdf';
import { ALL_VIEW, INBOX, LibraryPane, PROMPTS_VIEW, RECENT_VIEW, SEARCH_VIEW, SPECIAL_VIEWS, TRASH_VIEW } from './LibraryPane';
import { NotesPanel } from './NotesPanel';
import { PromptsPane } from './PromptsPane';
import { QuickCapture } from './QuickCapture';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SprintDialog, type SprintState } from './Sprint';
import { SearchPane } from './SearchPane';
import { WhatsNew } from './WhatsNew';
import { ResizeHandle } from './ResizeHandle';
import { NameDialog, type MenuItem, type NameRequest } from './Overlays';
import { SettingsDialog } from './SettingsDialog';
import { SheetList } from './SheetList';

type Layout = 'wide' | 'medium' | 'narrow';
type Pane = 'library' | 'sheets' | 'editor';
/** Which columns show beside the editor on Mac and iPad: the button beside the editor steps through these. */
type Panes = 'all' | 'noLibrary' | 'editor';

/** Column widths in pixels: [usual, narrowest, widest]. */
const WIDTHS = { library: [250, 180, 400], list: [330, 240, 560], notes: [300, 240, 600] } as const;
type Column = keyof typeof WIDTHS;
/** Whose notes are showing: the open sheet's, or a group's. */
type NotesTarget = { kind: 'sheet' } | { kind: 'group'; key: string } | null;

const SYNC_AFTER_CHANGE_MS = 2000;
const SYNC_RETRY_MS = 15_000;
const SYNC_EVERY_MS = 60_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPTS_KEY = keyOf(PROMPTS_PATH);

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

type Props = { engine: Engine; snapshots: Snapshots; onDisconnect: () => void };

export function Workspace({ engine, snapshots, onDisconnect }: Props) {
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
  // iPhone opens on the Library, unless you left in the middle of a sheet.
  const [pane, setPaneState] = useState<Pane>(() => (prefs.get<Pane>('phonePane', 'library') === 'editor' && prefs.get<string | null>('sheet', null) ? 'editor' : 'library'));
  const setPane = (p: Pane) => {
    setPaneState(p);
    if (layout === 'narrow') prefs.set('phonePane', p);
  };
  const [savedPanes, setPanes] = usePref<Panes>('panes', 'all');
  const [widths, setWidths] = usePref<Record<Column, number>>('widths', { library: WIDTHS.library[0], list: WIDTHS.list[0], notes: WIDTHS.notes[0] });
  const setFocusMode = (on: boolean) => setPanes(on ? 'editor' : 'all');
  /** All columns → without the Library → just the editor → all again (iPad portrait has no Library column to hide). */
  const cyclePanes = () => setPanes(panes === 'editor' ? 'all' : panes === 'all' && layout === 'wide' ? 'noLibrary' : 'editor');
  const [showWords, setShowWords] = usePref('words', false);
  const [sort, setSort] = usePref<SortOrder>('sort', 'edited');
  const [collapsedList, setCollapsedList] = usePref<string[]>('collapsed', []);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<NotesTarget>(null);
  const [typewriterOn, setTypewriterOn] = usePref('typewriter', false);
  /** The last real group you were in; sheets started from Prompts go there. */
  const [lastGroup, setLastGroup] = usePref<string>('lastGroup', INBOX);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [sprint, setSprint] = useState<(SprintState & { key: string }) | null>(null);
  const [sprintChoosing, setSprintChoosing] = useState(false);
  const [sprintResult, setSprintResult] = useState<string | null>(null);
  // Updates this device hasn't seen yet pop up once; Settings shows them all.
  const [whatsNew, setWhatsNew] = useState<{ all: boolean } | null>(() => (unseenUpdates().length ? { all: false } : null));
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);

  const special = SPECIAL_VIEWS.includes(groupKey);
  const group = special ? null : (library.groups.get(groupKey) ?? library.root);
  const inTrash = groupKey === TRASH_VIEW;
  const sheet = sheetKey ? engine.get(sheetKey) : undefined;
  const currentKey = sheet?.kind === 'file' ? sheet.key : null;
  const readOnly = sheet ? isWithin(sheet.path, TRASH) : false;
  // With no sheet open there's no toolbar to bring the sidebars back, so they always show.
  const panes: Panes = currentKey ? savedPanes : 'all';
  const focusMode = panes === 'editor';
  const isPromptList = currentKey === PROMPTS_KEY;

  // ---- Prompts ----
  const promptFile = engine.get(PROMPTS_KEY)?.text;
  /** The prompt list, created or topped up with any new batches of Quill's prompts. */
  const promptList = (): string | null => {
    const current = engine.get(PROMPTS_KEY)?.text;
    if (current !== undefined) {
      const merged = mergeBatches(current, PROMPT_BATCHES);
      if (merged !== current) engine.writeFile(PROMPTS_PATH, merged);
      return merged;
    }
    // Only after hearing from Dropbox, so another device's list isn't overwritten.
    if (!engine.status.lastSynced) return null;
    const fresh = newPromptFile(PROMPT_BATCHES);
    engine.writeFile(PROMPTS_PATH, fresh);
    return fresh;
  };
  /** A prompt, already ticked off. null: not ready; "": none left. */
  const takePrompt = (): string | null => {
    const file = promptList();
    if (file === null) return null;
    const prompt = pickPrompt(file);
    if (!prompt) return '';
    engine.writeFile(PROMPTS_PATH, markUsed(file, prompt, new Date()));
    return prompt.text;
  };

  // ---- Notes ----
  const notesGroup = notesTarget?.kind === 'group' ? library.groups.get(notesTarget.key) : undefined;
  const notes =
    notesTarget?.kind === 'sheet' && sheet?.kind === 'file'
      ? { path: notesPathFor(sheet.path), label: library.sheets.get(sheet.key)?.title || 'This sheet' }
      : notesGroup
        ? { path: `${notesGroup.path}/_Notes.md`, label: notesGroup.name }
        : null;
  const notesText = notes ? (engine.get(keyOf(notes.path))?.text ?? '') : '';
  const sheetNotesCount = sheet?.kind === 'file' ? parseNotes(engine.get(keyOf(notesPathFor(sheet.path)))?.text ?? '').length : 0;
  const sheetNotesPath = sheet?.kind === 'file' ? notesPathFor(sheet.path) : null;
  const sheetNotesText = sheetNotesPath ? engine.get(keyOf(sheetNotesPath))?.text ?? '' : '';
  const pinned = sheetNotesPath ? pinnedNote(sheetNotesText) : undefined;
  const unpin = () => {
    if (!sheetNotesPath) return;
    const index = parseNotes(sheetNotesText).findIndex((n) => n.pinned);
    if (index >= 0) engine.writeFile(sheetNotesPath, togglePin(sheetNotesText, index));
  };
  const toggleSheetNotes = () => setNotesTarget(notesTarget?.kind === 'sheet' ? null : { kind: 'sheet' });

  // A group that no longer exists (deleted on another device): fall back to Inbox.
  useEffect(() => {
    if (!special && groupKey !== INBOX && !library.groups.has(groupKey)) setGroupKey(INBOX);
  }, [groupKey, library, setGroupKey]);

  // ---- Rewind snapshots ----
  // The first time you open a sheet in a session, keep a copy of it as it was.
  // A session starts when Quill opens, or when you come back after 30 minutes away.
  const snapshotted = useRef(new Set<string>());
  useEffect(() => {
    const file = currentKey ? engine.get(currentKey) : undefined;
    if (!file || readOnly || snapshotted.current.has(file.id)) return;
    snapshotted.current.add(file.id);
    void snapshots.capture(file.id, file.text ?? '', 'opened');
  }, [currentKey, engine, readOnly, snapshots]);
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30 * 60_000) {
        snapshotted.current.clear();
        const file = currentKey ? engine.get(currentKey) : undefined;
        if (file && !readOnly) {
          snapshotted.current.add(file.id);
          void snapshots.capture(file.id, file.text ?? '', 'opened');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [currentKey, engine, readOnly, snapshots]);

  const restoreVersion = async (text: string) => {
    const file = currentKey ? engine.get(currentKey) : undefined;
    if (!file) return;
    await snapshots.capture(file.id, file.text ?? '', 'before restore');
    engine.setText(file.key, text);
  };

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
    if (!SPECIAL_VIEWS.includes(key)) setLastGroup(key);
    // Prompts opens your list beside it (on iPhone, from its own button).
    if (key === PROMPTS_VIEW && layout !== 'narrow' && promptList() !== null) openPromptList();
  };

  /** ⌥⌘F or the search button: open Search, or go back to where you were. */
  const beforeSearch = useRef<string>(INBOX);
  const toggleSearch = () => {
    if (groupKey === SEARCH_VIEW) {
      selectGroup(beforeSearch.current);
      return;
    }
    beforeSearch.current = groupKey;
    selectGroup(SEARCH_VIEW);
    if (focusMode) setPanes('all');
    setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.select(), 0);
  };

  /** ⌘F: the find and replace bar in the open sheet. */
  const findInSheet = () => {
    const dom = document.querySelector<HTMLElement>('.cm-editor');
    const view = dom && EditorView.findFromDOM(dom);
    if (view) openSearchPanel(view);
  };

  const openPromptList = () => {
    if (promptList() === null) return;
    if (currentKey !== PROMPTS_KEY) leaveSheet();
    setSheetKey(PROMPTS_KEY);
    setPane('editor');
  };

  /** A new sheet in `folder` that starts with the prompt as a comment. */
  const startPrompted = (folder: string, prompt: string) => {
    const created = engine.createSheet(folder);
    engine.setText(created.key, promptComment(prompt));
    openSheet(created.key);
    setTimeout(() => {
      const content = document.querySelector<HTMLElement>('.cm-content');
      content?.focus();
    }, 50);
  };

  const promptInGroup = () => {
    if (!group) return;
    const prompt = takePrompt();
    if (prompt === null) alert('Quill needs to reach Dropbox once before it can make your prompt list. Try again in a moment.');
    else if (prompt === '') alert('You’ve used every prompt on your list. Add more to it under Prompts, or ask for another batch.');
    else startPrompted(group.path, prompt);
  };

  const openHit = (hit: SearchHit) => {
    if (hit.kind === 'groupNotes') {
      setNotesTarget({ kind: 'group', key: hit.key });
      return;
    }
    openSheet(hit.key);
    setNotesTarget(hit.kind === 'sheetNotes' ? { kind: 'sheet' } : notesTarget?.kind === 'sheet' ? notesTarget : null);
  };

  const backToSheets = () => {
    setSheetKey(leaveSheet());
    setPane('sheets');
    if (layout === 'narrow') setNotesTarget(null);
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

  // ---- Deleting from Trash ----
  const deleteForGood = (key: string, name: string) => {
    if (!confirm(`Delete “${name || 'Untitled'}” permanently?\n\nIt can’t be brought back in Quill. Dropbox keeps deleted files for 30 days at dropbox.com, under Deleted files.`)) return;
    if (engine.deletePermanently(key) && (key === currentKey || (currentKey && isWithin(currentKey, key)))) setSheetKey(null);
  };

  // ---- Sprint ----
  const activeSprint = sprint && sprint.key === currentKey ? sprint : null;
  const startSprint = (minutes: number | null) => {
    if (!currentKey || readOnly) return;
    const now = Date.now();
    setSprint({ key: currentKey, startedAt: now, endsAt: minutes ? now + minutes * 60_000 : null, startWords: wordCount(sheet?.text ?? '') });
    setSprintChoosing(false);
    setSprintResult(null);
    setTimeout(() => document.querySelector<HTMLElement>('.cm-content')?.focus(), 50);
  };
  const endSprint = useCallback(
    (timeUp: boolean) => {
      setSprint((running) => {
        if (running) {
          const file = engine.get(running.key);
          const written = Math.max(0, wordCount(file?.text ?? '') - running.startWords);
          const minutes = Math.max(1, Math.round((Date.now() - running.startedAt) / 60_000));
          setSprintResult(`${timeUp ? 'Time’s up! ' : ''}${written.toLocaleString()} new word${written === 1 ? '' : 's'} in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
        }
        return null;
      });
    },
    [engine],
  );
  // Closing or deleting the open sheet leaves focus mode.
  const hadSheet = useRef(Boolean(currentKey));
  useEffect(() => {
    if (hadSheet.current && !currentKey && savedPanes !== 'all') setPanes('all');
    hadSheet.current = Boolean(currentKey);
  }, [currentKey, savedPanes, setPanes]);
  // Leaving the sheet ends its sprint.
  useEffect(() => {
    if (sprint && sprint.key !== currentKey) endSprint(false);
  }, [sprint, currentKey, endSprint]);

  /** ⌥⌘N: a fresh sheet in the Inbox, from wherever you are. */
  const newInboxSheet = () => {
    const created = engine.createSheet('');
    setGroupKey(INBOX);
    openSheet(created.key);
    setTimeout(() => document.querySelector<HTMLElement>('.cm-content')?.focus(), 50);
  };

  /** ⌘⇧J: add a jotted note to the bottom of Quick Notes. */
  const saveQuickNote = (note: string) => engine.writeFile(QUICK_NOTES_PATH, appendQuickNote(engine.get(keyOf(QUICK_NOTES_PATH))?.text, note, new Date()));

  // The shortcut handler below is set up once; this keeps it using the latest versions.
  const toggleSprint = () => (activeSprint ? endSprint(false) : currentKey && !readOnly && setSprintChoosing(true));
  const shortcuts = useRef({ newInboxSheet, toggleSprint, toggleSearch, findInSheet, sprinting: Boolean(activeSprint) });
  shortcuts.current = { newInboxSheet, toggleSprint, toggleSearch, findInSheet, sprinting: Boolean(activeSprint) };

  // ⌘⇧F focus mode, ⌘F search, ⌘⇧J quick note, ⌥⌘N new Inbox sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Already handled by the editor (like ⌘F or Esc in the find bar).
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape' && shortcuts.current.sprinting && !document.querySelector('.dialog')) {
        endSprint(false);
      } else if (mod && e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        shortcuts.current.toggleSprint();
      } else if (mod && e.shiftKey && e.code === 'KeyJ') {
        e.preventDefault();
        setCapturing(true);
      } else if (mod && e.altKey && e.code === 'KeyN') {
        e.preventDefault();
        shortcuts.current.newInboxSheet();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (currentKey || focusMode) setPanes(focusMode ? 'all' : 'editor');
      } else if (mod && e.altKey && e.code === 'KeyF') {
        e.preventDefault();
        shortcuts.current.toggleSearch();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        // ⌘F outside the writing: find in the open sheet, or search everything if none is open.
        e.preventDefault();
        if (currentKey) shortcuts.current.findInSheet();
        else shortcuts.current.toggleSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, currentKey, setPanes, endSprint]);

  // ---- Menus ----
  const groupMenu: MenuItem[] | undefined =
    group && group !== library.root
      ? [
          { label: 'Group notes', icon: 'paperclip', onSelect: () => setNotesTarget({ kind: 'group', key: group.key }) },
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

  const typewriterItem: MenuItem[] = layout === 'narrow' ? [] : [{ label: 'Typewriter mode', checked: typewriterOn, onSelect: () => setTypewriterOn(!typewriterOn) }];
  const sheetMenu: MenuItem[] = !sheet
    ? []
    : isPromptList
      ? [{ label: 'Word count', checked: showWords, onSelect: () => setShowWords(!showWords) }, ...typewriterItem]
      : readOnly
      ? [
          { label: 'Put back', icon: 'restore', onSelect: () => setSheetKey(engine.restore(sheet.key)) },
          { label: 'Delete permanently…', icon: 'trash', danger: true, onSelect: () => deleteForGood(sheet.key, library.sheets.get(sheet.key)?.title ?? library.trash.find((s) => s.key === sheet.key)?.title ?? '') },
          { label: 'Export PDF…', onSelect: () => setExporting(true) },
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
          { label: 'Export PDF…', onSelect: () => setExporting(true) },
          { label: 'Find and replace', onSelect: findInSheet },
          { label: 'Earlier versions…', onSelect: () => setShowVersions(true) },
          'divider',
          { label: 'Word count', checked: showWords, onSelect: () => setShowWords(!showWords) },
          ...(layout === 'narrow' ? [] : [{ label: 'Focus mode', checked: focusMode, onSelect: () => setFocusMode(!focusMode) }]),
          ...typewriterItem,
          { label: activeSprint ? 'End sprint' : 'Sprint…', onSelect: toggleSprint },
          ...(touch ? [] : [{ label: 'Keyboard shortcuts', onSelect: () => setShowShortcuts(true) }]),
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
  let banner: ReactNode = sprintResult ? (
    <div className="banner">
      Sprint done: {sprintResult}
      <button className="quiet small" onClick={() => setSprintResult(null)}>
        OK
      </button>
    </div>
  ) : null;
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
  const allSheets = [...library.sheets.values()];
  const recent = allSheets.filter((s) => s.modified > Date.now() - WEEK_MS);
  const TITLES: Record<string, string> = { [TRASH_VIEW]: 'Trash', [ALL_VIEW]: 'All', [RECENT_VIEW]: 'Last 7 Days' };
  const listTitle = TITLES[groupKey] ?? (group === library.root ? 'Inbox' : (group?.name ?? ''));
  const listSheets = sortSheets(inTrash ? library.trash : groupKey === ALL_VIEW ? allSheets : groupKey === RECENT_VIEW ? recent : (group?.sheets ?? []), sort);
  const acrossGroups = groupKey === ALL_VIEW || groupKey === RECENT_VIEW;
  const texts = useMemo(() => new Map(engine.all().map((f) => [f.key, f.text ?? ''])), [engine, revision]);
  const hits = useMemo(() => (groupKey === SEARCH_VIEW ? search(library, texts, query) : []), [groupKey, library, texts, query]);
  const promptDestination = library.groups.get(lastGroup) ?? library.root;

  const libraryPane = (
    <LibraryPane
      library={library}
      selected={groupKey}
      collapsed={collapsed}
      status={engine.status}
      recentCount={recent.length}
      promptsLeft={promptFile === undefined ? null : unusedPrompts(promptFile).length}
      onSelect={(key) => (key === SEARCH_VIEW ? toggleSearch() : selectGroup(key))}
      onToggle={toggleCollapsed}
      onNewGroup={() => newGroup('')}
      onSettings={() => setSettingsOpen(true)}
    />
  );

  const backToLibrary = layout === 'wide' ? undefined : layout === 'narrow' ? () => setPane('library') : () => setLibraryOpen(true);
  const middle =
    groupKey === PROMPTS_VIEW ? (
      <PromptsPane
        unused={promptFile === undefined ? PROMPT_BATCHES.flat().length : unusedPrompts(promptFile).length}
        used={promptFile === undefined ? 0 : usedCount(promptFile)}
        destination={promptDestination === library.root ? 'Inbox' : promptDestination.name}
        onTake={takePrompt}
        onStart={(prompt) => startPrompted(promptDestination.path, prompt)}
        onOpenList={openPromptList}
        onBack={backToLibrary}
      />
    ) : groupKey === SEARCH_VIEW ? (
      <SearchPane query={query} hits={hits} onQuery={setQuery} onOpen={openHit} onBack={backToLibrary} onClose={toggleSearch} />
    ) : null;

  const sheetList = middle ?? (
    <SheetList
      title={listTitle}
      sheets={listSheets}
      selectedKey={currentKey}
      sort={sort}
      onSort={setSort}
      onOpen={openSheet}
      onBack={backToLibrary}
      onNew={group ? newSheet : undefined}
      onPrompt={group ? promptInGroup : undefined}
      whereOf={acrossGroups ? (path) => whereOf(library, parentOf(path)) : undefined}
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
              onDelete: deleteForGood,
            }
          : undefined
      }
    />
  );

  const editorPane = (
    <EditorPane
      sheetKey={currentKey}
      sheetId={sheet?.kind === 'file' ? sheet.id : null}
      text={sheet?.text ?? ''}
      readOnly={readOnly}
      unsynced={currentKey ? unsynced.has(currentKey) : false}
      touch={touch}
      focusMode={focusMode && layout !== 'narrow'}
      showWords={showWords}
      typewriterMode={typewriterOn && layout !== 'narrow'}
      sprint={activeSprint}
      onEndSprint={endSprint}
      menu={sheetMenu}
      banner={banner}
      onChange={onChange}
      onBack={layout === 'narrow' ? backToSheets : undefined}
      onToggleFocus={layout === 'narrow' ? undefined : cyclePanes}
      onToggleWords={() => setShowWords(!showWords)}
      notesCount={isPromptList ? -1 : sheetNotesCount}
      pinned={pinned && !isPromptList ? { title: pinned.title, body: pinned.body } : undefined}
      onUnpin={unpin}
      notesOpen={notesTarget?.kind === 'sheet'}
      onToggleNotes={toggleSheetNotes}
    />
  );

  const notesPanel = notes && (
    <NotesPanel
      path={notes.path}
      label={notes.label}
      text={notesText}
      readOnly={isWithin(notes.path, TRASH)}
      onChange={(text) => engine.writeFile(notes.path, text)}
      onClose={() => setNotesTarget(null)}
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

  // ---- Columns ----
  const showLibrary = layout === 'wide' && panes === 'all';
  const showList = !focusMode;
  const showNotes = layout === 'wide' && Boolean(notesPanel);
  const columns =
    layout === 'narrow'
      ? 'minmax(0, 1fr)'
      : [showLibrary && `${widths.library}px`, showList && `${widths.list}px`, 'minmax(0, 1fr)', showNotes && `${widths.notes}px`].filter(Boolean).join(' ');

  const column = (name: Column, edge: 'left' | 'right', content: ReactNode) => (
    <div className="column">
      {content}
      <ResizeHandle
        edge={edge}
        width={widths[name]}
        min={WIDTHS[name][1]}
        max={WIDTHS[name][2]}
        onResize={(w) => setWidths({ ...widths, [name]: w })}
        onReset={() => setWidths({ ...widths, [name]: WIDTHS[name][0] })}
      />
    </div>
  );

  return (
    <div
      className={`workspace ${layout}${focusMode && layout !== 'narrow' ? ' focus' : ''}`}
      style={{ gridTemplateColumns: columns }}
      onTouchStart={layout === 'narrow' ? onTouchStart : undefined}
      onTouchEnd={layout === 'narrow' ? onTouchEnd : undefined}
    >
      {layout === 'narrow' ? (
        notesPanel && (notesTarget?.kind === 'group' || pane === 'editor') ? (
          notesPanel
        ) : pane === 'library' ? (
          libraryPane
        ) : pane === 'sheets' || !currentKey ? (
          sheetList
        ) : (
          editorPane
        )
      ) : (
        <>
          {showLibrary && column('library', 'right', libraryPane)}
          {showList && column('list', 'right', sheetList)}
          {editorPane}
          {showNotes && column('notes', 'left', notesPanel)}
          {layout === 'medium' && notesPanel && (
            <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setNotesTarget(null)}>
              <div className="drawer right">{notesPanel}</div>
            </div>
          )}
          {layout === 'medium' && libraryOpen && (
            <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setLibraryOpen(false)}>
              <div className="drawer">{libraryPane}</div>
            </div>
          )}
        </>
      )}
      {nameRequest && <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />}
      {settingsOpen && (
        <SettingsDialog
          engine={engine}
          onDisconnect={onDisconnect}
          onWhatsNew={() => {
            setSettingsOpen(false);
            setWhatsNew({ all: true });
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {exporting && sheet?.kind === 'file' && (
        <ExportPdf text={sheet.text ?? ''} fallbackTitle={library.sheets.get(sheet.key)?.name ?? 'Untitled'} onClose={() => setExporting(false)} />
      )}
      {showVersions && sheet?.kind === 'file' && (
        <EarlierVersions fileId={sheet.id} snapshots={snapshots} onRestore={restoreVersion} onClose={() => setShowVersions(false)} />
      )}
      {sprintChoosing && <SprintDialog onStart={startSprint} onClose={() => setSprintChoosing(false)} />}
      {capturing && <QuickCapture onSave={saveQuickNote} onClose={() => setCapturing(false)} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {whatsNew && (
        <WhatsNew
          updates={whatsNew.all ? updates : unseenUpdates()}
          onClose={() => {
            markUpdatesSeen();
            setWhatsNew(null);
          }}
        />
      )}
    </div>
  );
}
