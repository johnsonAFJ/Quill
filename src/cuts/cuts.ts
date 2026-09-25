// Pieces you set aside from a sheet. Each sheet can have a cuts file beside
// it in Dropbox ("The Lighthouse.cuts.md"), hidden from the Library. A cut is
// a "## date and time" heading and the text under it, newest first. Nothing
// here counts towards your words, and Quill only removes a cut when you say so.

import { joinNotes, parseNotes, writeNote } from '../notes/notes';
import { wordCount } from '../text/markdown';

export type Cut = {
  /** When it was set aside, e.g. "Tue, Sep 24 · 9:14 PM". */
  when: string;
  text: string;
  words: number;
  /** Where it sits in the file, for putting back or deleting. */
  index: number;
};

const HEADER = '# Cuts\n\nPieces set aside from this sheet. Put one back from the sheet’s ••• menu, or take it from here.\n\n';

/** "Tue, Sep 24 · 9:14 PM" */
function stamp(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function parseCuts(file: string): Cut[] {
  const cuts: Cut[] = [];
  parseNotes(file).forEach((note, index) => {
    if (!note.raw.startsWith('## ')) return; // the "# Cuts" heading and its note to self
    cuts.push({ when: note.title, text: note.body, words: wordCount(note.body), index });
  });
  return cuts;
}

/** The cuts file with `text` added at the top. Anything already there is left alone. */
export function addCut(file: string | undefined, text: string, date: Date): string {
  const piece = text.trim();
  if (!piece) return file ?? '';
  const notes = parseNotes(file ?? '');
  const heading = notes.length && !notes[0]!.raw.startsWith('## ') ? [notes.shift()!] : [];
  const cut = writeNote(stamp(date), piece);
  const kept = [...heading, cut, ...notes].map((n) => (n.raw.endsWith('\n\n') ? n : { ...n, raw: n.raw.replace(/\n*$/, '\n\n') }));
  return (file?.trim() ? '' : HEADER) + joinNotes(kept);
}

/** The cuts file without cut `index`, or '' once the last one is gone. */
export function removeCut(file: string, index: number): string {
  const notes = parseNotes(file);
  if (!notes[index]?.raw.startsWith('## ')) return file;
  notes.splice(index, 1);
  return notes.some((n) => n.raw.startsWith('## ')) ? joinNotes(notes) : '';
}
