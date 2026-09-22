import { describe, expect, it } from 'vitest';
import { search } from './search';
import { buildLibrary, type Entry } from './tree';

const files: Entry[] = [
  { kind: 'folder', path: '/Short Stories' },
  { kind: 'folder', path: '/Short Stories/Prompted' },
  { kind: 'file', path: '/Short Stories/Prompted/Backroom.md', text: '# The Backroom\n\nI light the old wall sconce and reach for a book.', modified: 2 },
  { kind: 'file', path: '/Short Stories/Prompted/Backroom.notes.md', text: '## Critique\nThe sconce detail is strong. Pencroft would approve.' },
  { kind: 'file', path: '/Short Stories/_Notes.md', text: '## Theme\nEvery story has a lighthouse.' },
  { kind: 'file', path: '/Loose.md', text: '# Loose idea\n\nA lighthouse keeper and a book.', modified: 5 },
  { kind: 'folder', path: '/_Trash' },
  { kind: 'file', path: '/_Trash/Old.md', text: 'A lighthouse in the bin.' },
];
const library = buildLibrary(files);
const texts = new Map(files.filter((f) => f.text).map((f) => [f.path.toLowerCase(), f.text!]));
const find = (q: string) => search(library, texts, q).map((h) => `${h.kind}:${h.title} (${h.where})`);

describe('search', () => {
  it('finds sheets, their notes and group notes, but not Trash', () => {
    expect(find('lighthouse')).toEqual(['sheet:Loose idea (Inbox)', 'groupNotes:Short Stories (Library)']);
    expect(find('sconce')).toEqual(['sheet:The Backroom (Short Stories › Prompted)', 'sheetNotes:The Backroom (Short Stories › Prompted)']);
  });

  it('needs every word, in any order, ignoring case', () => {
    expect(find('BOOK sconce')).toEqual(['sheet:The Backroom (Short Stories › Prompted)']);
    expect(find('book pencroft')).toEqual([]);
  });

  it('puts title matches first', () => {
    expect(find('backroom')).toEqual(['sheet:The Backroom (Short Stories › Prompted)']);
    expect(find('book')).toEqual(['sheet:Loose idea (Inbox)', 'sheet:The Backroom (Short Stories › Prompted)']);
    expect(find('loose book')).toEqual(['sheet:Loose idea (Inbox)']);
  });

  it('shows the text around the match', () => {
    const hit = search(library, texts, 'pencroft')[0]!;
    expect(hit.snippet.match).toBe('Pencroft');
    expect(hit.snippet.before).toContain('sconce detail is strong.');
  });

  it('finds nothing for an empty search', () => {
    expect(search(library, texts, '   ')).toEqual([]);
  });
});
