// Searching every sheet and notes file. A result needs every word you typed,
// in any order, anywhere in the same sheet (or the same notes file).

import { notesPathFor, parentOf } from '../sync/paths';
import type { Library } from './tree';

export type SearchHit = {
  kind: 'sheet' | 'sheetNotes' | 'groupNotes';
  /** The sheet to open, or the group whose notes matched. */
  key: string;
  title: string;
  /** "Essays", "Short Stories › Prompted", or "Inbox". */
  where: string;
  /** Text around the first match, split so the match can be highlighted. */
  snippet: { before: string; match: string; after: string };
  modified: number;
};

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** "Short Stories › Prompted" for a folder, or `top` for the top of the Library. */
export function whereOf(library: Library, folderPath: string, top = 'Inbox'): string {
  const parts: string[] = [];
  for (let p = folderPath; p; p = parentOf(p)) {
    const group = library.groups.get(p.toLowerCase());
    if (group) parts.unshift(group.name);
  }
  return parts.length ? parts.join(' › ') : top;
}

function snippetOf(text: string, word: string) {
  const flat = text.replace(/\s+/g, ' ');
  const at = flat.toLowerCase().indexOf(word);
  const start = Math.max(0, at - 50);
  const end = Math.min(flat.length, at + word.length + 90);
  return {
    before: (start > 0 ? '…' : '') + flat.slice(start, at),
    match: flat.slice(at, at + word.length),
    after: flat.slice(at + word.length, end) + (end < flat.length ? '…' : ''),
  };
}

/** `texts` holds each file's text by key (lowercased path). */
export function search(library: Library, texts: Map<string, string>, query: string): SearchHit[] {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  const matches = (text: string) => {
    const lower = text.toLowerCase();
    return wanted.every((w) => lower.includes(w));
  };

  const hits: (SearchHit & { titleMatch: boolean })[] = [];
  for (const sheet of library.sheets.values()) {
    const where = whereOf(library, parentOf(sheet.path));
    const text = texts.get(sheet.key) ?? '';
    const titleMatch = matches(sheet.title);
    if (matches(text) || titleMatch) {
      hits.push({ kind: 'sheet', key: sheet.key, title: sheet.title, where, snippet: snippetOf(text || sheet.title, wanted[0]!), modified: sheet.modified, titleMatch });
    }
    const notes = texts.get(notesPathFor(sheet.path).toLowerCase());
    if (notes && matches(notes)) {
      hits.push({ kind: 'sheetNotes', key: sheet.key, title: sheet.title, where, snippet: snippetOf(notes, wanted[0]!), modified: sheet.modified, titleMatch: false });
    }
  }
  for (const group of library.groups.values()) {
    if (!group.key) continue;
    const notes = texts.get(`${group.key}/_notes.md`);
    if (notes && matches(notes)) {
      hits.push({ kind: 'groupNotes', key: group.key, title: group.name, where: whereOf(library, parentOf(group.path), 'Library'), snippet: snippetOf(notes, wanted[0]!), modified: 0, titleMatch: false });
    }
  }
  // Title matches first, then the most recently edited.
  return hits.sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch) || b.modified - a.modified).map(({ titleMatch: _, ...hit }) => hit);
}
