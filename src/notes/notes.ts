// A notes file holds many notes, each starting with a "## Heading" line.
// Quill shows each note as a card. Notes you don't edit keep their exact
// original text, so opening a notes file never rewrites it.

export type Note = {
  /** The note exactly as it appears in the file. */
  raw: string;
  /** The heading without "## ", or "" for text before the first heading. */
  title: string;
  body: string;
};

const HEADING = /^## /m;

export function parseNotes(text: string): Note[] {
  if (!text.trim()) return [];
  const starts: number[] = [];
  const re = /^## /gm;
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push(m.index);
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((start, i) => toNote(text.slice(start, starts[i + 1] ?? text.length))).filter((n) => n.raw.trim() !== '');
}

function toNote(raw: string): Note {
  if (!HEADING.test(raw.slice(0, 3))) return { raw, title: '', body: raw.trim() };
  const newline = raw.indexOf('\n');
  const title = (newline < 0 ? raw.slice(3) : raw.slice(3, newline)).trim();
  const body = newline < 0 ? '' : raw.slice(newline + 1).trim();
  return { raw, title, body };
}

export function joinNotes(notes: Note[]): string {
  return notes.map((n) => n.raw).join('');
}

/**
 * The note rebuilt from a new title and body. It keeps its "## " line even
 * with an empty title, so it can't merge into the note above it. Only text
 * before the first heading (`headingless`) goes without one.
 */
export function writeNote(title: string, body: string, headingless = false): Note {
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const cleanBody = body.trim();
  const heading = headingless && !cleanTitle ? '' : `## ${cleanTitle}\n`;
  const raw = heading + (cleanBody ? `${cleanBody}\n` : '') + '\n';
  return { raw, title: cleanTitle, body: cleanBody };
}

/** Replaces note `index` and returns the file's new text. */
export function updateNote(text: string, index: number, title: string, body: string): string {
  const notes = parseNotes(text);
  const original = notes[index];
  if (!original) return text;
  notes[index] = writeNote(title, body, index === 0 && !original.raw.startsWith('## '));
  return joinNotes(separate(notes));
}

export function addNote(text: string, title = 'New note'): string {
  return joinNotes(separate([...parseNotes(text), writeNote(title, '')]));
}

export function removeNote(text: string, index: number): string {
  const notes = parseNotes(text);
  notes.splice(index, 1);
  return joinNotes(separate(notes));
}

/** Makes sure each note ends with a newline so the next heading starts on its own line. */
function separate(notes: Note[]): Note[] {
  return notes.map((n, i) => (i < notes.length - 1 && !n.raw.endsWith('\n') ? { ...n, raw: n.raw + '\n\n' } : n));
}
