// Turns the flat list of files Dropbox returns into the Library tree:
// folders are groups, .md files are sheets, and the app's own files stay out
// of sight. See "How it maps to Dropbox" in SPEC.md.

export type Entry = {
  kind: 'folder' | 'file';
  /** Path inside the app folder, starting with "/", e.g. "/Essays/On Walking.md". */
  path: string;
  /** Last change on Dropbox, ISO date. Files only. */
  modified?: string;
};

export type Sheet = { name: string; title: string; path: string; modified?: string; hasNotes: boolean };

export type Group = { name: string; path: string; groups: Group[]; sheets: Sheet[]; hasNotes: boolean };

export type Library = { root: Group; trash: Sheet[] };

export const TRASH_FOLDER = '_Trash';
const GROUP_NOTES = '_notes.md';
const SHEET_NOTES_SUFFIX = '.notes.md';

type Role = 'group' | 'trash' | 'hidden' | 'sheet' | 'sheetNotes' | 'groupNotes' | 'other';

/** What a single file or folder name means to the Library. */
export function roleOf(name: string, kind: Entry['kind']): Role {
  const lower = name.toLowerCase();
  if (kind === 'folder') {
    if (name === TRASH_FOLDER) return 'trash';
    return name.startsWith('_') ? 'hidden' : 'group';
  }
  if (lower === GROUP_NOTES) return 'groupNotes';
  if (lower.endsWith(SHEET_NOTES_SUFFIX)) return 'sheetNotes';
  if (lower.endsWith('.md')) return 'sheet';
  return 'other';
}

function stripMd(name: string): string {
  return name.replace(/\.md$/i, '');
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function buildLibrary(entries: Entry[]): Library {
  const root: Group = { name: '', path: '', groups: [], sheets: [], hasNotes: false };
  const trash: Sheet[] = [];
  const groups = new Map<string, Group>([['', root]]);
  const notesFor = new Set<string>();

  // Sort so parents are seen before children.
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  const isInside = (parts: string[], kind: Entry['kind']): 'visible' | 'trash' | 'hidden' => {
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const role = roleOf(parts[i]!, isLast ? kind : 'folder');
      if (!isLast && role === 'trash') return 'trash';
      if (!isLast && role === 'hidden') return 'hidden';
    }
    return 'visible';
  };

  for (const entry of sorted) {
    const parts = splitPath(entry.path);
    const name = parts[parts.length - 1];
    if (!name) continue;
    const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '';
    const where = isInside(parts, entry.kind);
    const role = roleOf(name, entry.kind);

    if (where === 'hidden') continue;
    if (where === 'trash') {
      if (role === 'sheet') trash.push({ name: stripMd(name), title: stripMd(name), path: entry.path, modified: entry.modified, hasNotes: false });
      continue;
    }

    const parent = groups.get(parentPath.toLowerCase());
    if (!parent) continue;

    if (role === 'group') {
      const group: Group = { name, path: entry.path, groups: [], sheets: [], hasNotes: false };
      parent.groups.push(group);
      groups.set(entry.path.toLowerCase(), group);
    } else if (role === 'sheet') {
      parent.sheets.push({ name: stripMd(name), title: stripMd(name), path: entry.path, modified: entry.modified, hasNotes: false });
    } else if (role === 'groupNotes') {
      parent.hasNotes = true;
    } else if (role === 'sheetNotes') {
      notesFor.add(entry.path.slice(0, -SHEET_NOTES_SUFFIX.length).toLowerCase() + '.md');
    }
  }

  for (const group of groups.values()) {
    for (const sheet of group.sheets) sheet.hasNotes = notesFor.has(sheet.path.toLowerCase());
  }
  return { root, trash };
}
