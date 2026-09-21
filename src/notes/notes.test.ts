import { describe, expect, it } from 'vitest';
import { addNote, joinNotes, parseNotes, removeNote, updateNote } from './notes';

const FILE = `Loose thoughts before any heading.

## Character ideas
Pencroft is a sailor.
Harding leads.

## Sources
- The Mysterious Island
`;

describe('parseNotes', () => {
  it('splits a file into notes at each "## " heading', () => {
    const notes = parseNotes(FILE);
    expect(notes.map((n) => n.title)).toEqual(['', 'Character ideas', 'Sources']);
    expect(notes[1]!.body).toBe('Pencroft is a sailor.\nHarding leads.');
  });

  it('gives back the exact original text when nothing is edited', () => {
    expect(joinNotes(parseNotes(FILE))).toBe(FILE);
  });

  it('treats an empty file as no notes', () => {
    expect(parseNotes('')).toEqual([]);
    expect(parseNotes('\n\n')).toEqual([]);
  });

  it('keeps "# " headings inside a note’s body', () => {
    expect(parseNotes('## A\n# Big\ntext\n').map((n) => n.body)).toEqual(['# Big\ntext']);
  });
});

describe('editing notes', () => {
  it('changes only the edited note', () => {
    const text = updateNote(FILE, 1, 'Characters', 'Pencroft is a sailor.');
    expect(text).toBe(`Loose thoughts before any heading.

## Characters
Pencroft is a sailor.

## Sources
- The Mysterious Island
`);
  });

  it('keeps a note separate while its heading is cleared', () => {
    const text = updateNote(FILE, 2, '', '- The Mysterious Island');
    expect(parseNotes(text).map((n) => n.title)).toEqual(['', 'Character ideas', '']);
    expect(parseNotes(updateNote(text, 2, 'Reading', '')).map((n) => n.title)).toEqual(['', 'Character ideas', 'Reading']);
  });

  it('adds a note at the end, on its own line', () => {
    expect(addNote('## A\ntext')).toBe('## A\ntext\n\n## New note\n\n');
    expect(parseNotes(addNote('')).map((n) => n.title)).toEqual(['New note']);
  });

  it('removes a note', () => {
    expect(parseNotes(removeNote(FILE, 1)).map((n) => n.title)).toEqual(['', 'Sources']);
  });
});
