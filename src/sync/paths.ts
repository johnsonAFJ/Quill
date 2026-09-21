// Path helpers. Paths start with "/" and use the display spelling; keys are lowercased.

export const keyOf = (path: string) => path.toLowerCase();

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i <= 0 ? '' : path.slice(0, i);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function join(folder: string, name: string): string {
  return `${folder}/${name}`;
}

/** "On Walking.md" → "On Walking" */
export function stem(name: string): string {
  return name.replace(/\.md$/i, '');
}

/** The notes file that belongs to a sheet. */
export function notesPathFor(sheetPath: string): string {
  return sheetPath.replace(/\.md$/i, '') + '.notes.md';
}

/** True if `path` is `folder` itself or anything inside it. */
export function isWithin(path: string, folder: string): boolean {
  const p = keyOf(path);
  const f = keyOf(folder);
  return p === f || p.startsWith(f + '/');
}

export const TRASH = '/_Trash';
export const BACKUPS = '/_quill/backups';
