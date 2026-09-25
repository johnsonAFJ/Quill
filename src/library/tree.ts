// Turns this device's flat list of files into the Library tree:
// folders are groups, .md files are sheets, and the app's own files stay out
// of sight. See "How it maps to Dropbox" in SPEC.md.

import { previewOf, titleOf } from '../text/markdown';

export type Entry = {
  kind: 'folder' | 'file';
  /** Path inside the app folder, starting with "/", e.g. "/Essays/On Walking.md". */
  path: string;
  key?: string;
  text?: string;
  /** Last change, in milliseconds. */
  modified?: number;
};

export type Sheet = {
  key: string;
  /** File name without ".md". */
  name: string;
  /** First line of the text, or the file name if the sheet is empty. */
  title: string;
  preview: string;
  path: string;
  modified: number;
  hasNotes: boolean;
  /** Keys of "(conflict, …)" copies sitting next to this sheet. */
  conflicts: string[];
};

export type Group = { key: string; name: string; path: string; groups: Group[]; sheets: Sheet[]; hasNotes: boolean };

/** A group that was moved to Trash as a whole. */
export type TrashedGroup = { key: string; name: string; path: string; sheetCount: number };

export type Library = {
  root: Group;
  /** Sheets and groups directly inside Trash. */
  trash: Sheet[];
  trashGroups: TrashedGroup[];
  groups: Map<string, Group>;
  sheets: Map<string, Sheet>;
};

export const TRASH_FOLDER = '_Trash';
const GROUP_NOTES = '_notes.md';
/** The prompt list (see src/prompts). It opens from "Prompts" in the Library, not as a sheet. */
const PROMPT_LIST = '_prompts.md';
const SHEET_NOTES_SUFFIX = '.notes.md';
/** Pieces set aside from a sheet (see src/cuts). Hidden, like notes. */
const SHEET_CUTS_SUFFIX = '.cuts.md';

type Role = 'group' | 'trash' | 'hidden' | 'sheet' | 'sheetNotes' | 'sheetCuts' | 'groupNotes' | 'other';

/** What a single file or folder name means to the Library. */
export function roleOf(name: string, kind: Entry['kind']): Role {
  const lower = name.toLowerCase();
  if (kind === 'folder') {
    if (name === TRASH_FOLDER) return 'trash';
    return name.startsWith('_') ? 'hidden' : 'group';
  }
  if (lower === GROUP_NOTES) return 'groupNotes';
  if (lower === PROMPT_LIST) return 'other';
  if (lower.endsWith(SHEET_NOTES_SUFFIX)) return 'sheetNotes';
  if (lower.endsWith(SHEET_CUTS_SUFFIX)) return 'sheetCuts';
  if (lower.endsWith('.md')) return 'sheet';
  return 'other';
}

const stripMd = (name: string) => name.replace(/\.md$/i, '');

function toSheet(entry: Entry, name: string): Sheet {
  const text = entry.text ?? '';
  return {
    key: entry.key ?? entry.path.toLowerCase(),
    name: stripMd(name),
    title: titleOf(text) || stripMd(name),
    preview: previewOf(text),
    path: entry.path,
    modified: entry.modified ?? 0,
    hasNotes: false,
    conflicts: [],
  };
}

export function buildLibrary(entries: Entry[]): Library {
  const root: Group = { key: '', name: '', path: '', groups: [], sheets: [], hasNotes: false };
  const trash: Sheet[] = [];
  const trashGroups: TrashedGroup[] = [];
  const groups = new Map<string, Group>([['', root]]);
  const sheets = new Map<string, Sheet>();
  const notesFor = new Set<string>();

  // Sort so parents are seen before children.
  const sorted = [...entries].sort((a, b) => a.path.toLowerCase().localeCompare(b.path.toLowerCase()));

  for (const entry of sorted) {
    const parts = entry.path.split('/').filter(Boolean);
    const name = parts[parts.length - 1];
    if (!name) continue;
    const folders = parts.slice(0, -1);
    const role = roleOf(name, entry.kind);
    const inTrash = folders.length > 0 && roleOf(folders[0]!, 'folder') === 'trash';
    if (!inTrash && folders.some((f) => roleOf(f, 'folder') !== 'group')) continue;

    if (inTrash) {
      if (folders.length === 1 && role === 'sheet') trash.push(toSheet(entry, name));
      if (folders.length === 1 && entry.kind === 'folder') trashGroups.push({ key: entry.path.toLowerCase(), name, path: entry.path, sheetCount: 0 });
      if (folders.length > 1 && role === 'sheet') {
        const owner = trashGroups.find((g) => g.name.toLowerCase() === folders[1]!.toLowerCase());
        if (owner) owner.sheetCount++;
      }
      continue;
    }

    const parent = groups.get(('/' + folders.join('/')).replace(/^\/$/, '').toLowerCase());
    if (!parent) continue;

    if (role === 'group') {
      const key = entry.path.toLowerCase();
      const group: Group = { key, name, path: entry.path, groups: [], sheets: [], hasNotes: false };
      parent.groups.push(group);
      groups.set(key, group);
    } else if (role === 'sheet') {
      const sheet = toSheet(entry, name);
      parent.sheets.push(sheet);
      sheets.set(sheet.key, sheet);
    } else if (role === 'groupNotes') {
      if (entry.text?.trim()) parent.hasNotes = true;
    } else if (role === 'sheetNotes' && entry.text?.trim()) {
      notesFor.add(entry.path.slice(0, -SHEET_NOTES_SUFFIX.length).toLowerCase() + '.md');
    }
  }

  for (const group of groups.values()) {
    for (const sheet of group.sheets) {
      sheet.hasNotes = notesFor.has(sheet.key);
      const prefix = `${sheet.name} (conflict, `.toLowerCase();
      sheet.conflicts = group.sheets.filter((s) => s.name.toLowerCase().startsWith(prefix)).map((s) => s.key);
    }
  }
  return { root, trash, trashGroups, groups, sheets };
}

export type SortOrder = 'edited' | 'name';

export function sortSheets(sheets: Sheet[], order: SortOrder): Sheet[] {
  return [...sheets].sort((a, b) =>
    order === 'edited' ? b.modified - a.modified || a.title.localeCompare(b.title) : a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}
