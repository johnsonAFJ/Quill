// A notes file holds many notes, each starting with a "## Heading" line.
// Quill shows each note as a card. Notes you don't edit keep their exact
// original text, so opening a notes file never rewrites it.

export type Note = {
  /** The note exactly as it appears in the file. */
  raw: string;
  /** The heading without "## ", or "" for text before the first heading. */
  title: string;
  body: string;
  /** Shown in a strip below the writing ("## Outline <!-- pinned -->" in the file). */
  pinned: boolean;
};

const HEADING = /^## /m;
const PIN_MARK = ' <!-- pinned -->';
const PIN = /\s*<!-- pinned -->\s*$/;

export function parseNotes(text: string): Note[] {
  if (!text.trim()) return [];
  const starts: number[] = [];
  const re = /^## /gm;
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push(m.index);
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((start, i) => toNote(text.slice(start, starts[i + 1] ?? text.length))).filter((n) => n.raw.trim() !== '');
}

function toNote(raw: string): Note {
  if (!HEADING.test(raw.slice(0, 3))) return { raw, title: '', body: raw.trim(), pinned: false };
  const newline = raw.indexOf('\n');
  const heading = newline < 0 ? raw.slice(3) : raw.slice(3, newline);
  const pinned = PIN.test(heading);
  const title = heading.replace(PIN, '').trim();
  const body = newline < 0 ? '' : raw.slice(newline + 1).trim();
  return { raw, title, body, pinned };
}

export function joinNotes(notes: Note[]): string {
  return notes.map((n) => n.raw).join('');
}

/**
 * The note rebuilt from a new title and body. It keeps its "## " line even
 * with an empty title, so it can't merge into the note above it. Only text
 * before the first heading (`headingless`) goes without one.
 */
export function writeNote(title: string, body: string, headingless = false, pinned = false): Note {
  const cleanTitle = title.replace(/\s+/g, ' ').replace(PIN, '').trim();
  const cleanBody = body.trim();
  const heading = headingless && !cleanTitle ? '' : `## ${cleanTitle}${pinned ? PIN_MARK : ''}\n`;
  const raw = heading + (cleanBody ? `${cleanBody}\n` : '') + '\n';
  return { raw, title: cleanTitle, body: cleanBody, pinned: pinned && Boolean(heading) };
}

/** Replaces note `index` and returns the file's new text. */
export function updateNote(text: string, index: number, title: string, body: string): string {
  const notes = parseNotes(text);
  const original = notes[index];
  if (!original) return text;
  notes[index] = writeNote(title, body, index === 0 && !original.raw.startsWith('## '), original.pinned);
  return joinNotes(separate(notes));
}

/** Pins note `index` (unpinning any other: one pinned note per notes file), or unpins it. */
export function togglePin(text: string, index: number): string {
  const notes = parseNotes(text);
  const target = notes[index];
  if (!target || !target.raw.startsWith('## ')) return text;
  const pinning = !target.pinned;
  return joinNotes(
    notes.map((n, i) => {
      const wantPinned = i === index ? pinning : false;
      if (n.pinned === wantPinned) return n;
      const newline = n.raw.indexOf('\n');
      const rest = newline < 0 ? '\n' : n.raw.slice(newline);
      return { ...n, pinned: wantPinned, raw: `## ${n.title}${wantPinned ? PIN_MARK : ''}${rest}` };
    }),
  );
}

export function pinnedNote(text: string): Note | undefined {
  return parseNotes(text).find((n) => n.pinned);
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
