// The outline of a sheet: its headings, as a skeleton you can build and
// rearrange. There's no second document — the headings in your writing are the
// outline, so the two can never drift apart. Moving a section moves its
// writing with it; the I / A / 1 numbers are shown, never written to the file.

export type Heading = {
  /** 2 for "##", 3 for "###", and so on. */
  level: number;
  /** The heading without its "#" marks. */
  title: string;
  /** How deep it sits in the outline: 0 for the top level shown. */
  depth: number;
  /** "I", "A", "3" — for showing beside the line, not for the file. */
  number: string;
  line: number;
  /** Where its section starts and ends in the text (the heading line included). */
  from: number;
  to: number;
};

// A heading that has no name yet ("## ") still counts: that's what a new,
// unnamed section looks like while you're building the skeleton.
const HEADING = /^(#{1,6})(?:[ \t]+(.*))?$/;

const ROMAN: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function roman(n: number): string {
  let left = n;
  let out = '';
  for (const [value, letter] of ROMAN) {
    while (left >= value) {
      out += letter;
      left -= value;
    }
  }
  return out;
}

function letters(n: number, upper: boolean): string {
  let left = n;
  let out = '';
  while (left > 0) {
    const i = (left - 1) % 26;
    out = String.fromCharCode((upper ? 65 : 97) + i) + out;
    left = Math.floor((left - 1) / 26);
  }
  return out;
}

/** I, A, 1, a, then plain numbers further down. */
function label(depth: number, count: number): string {
  if (depth === 0) return roman(count);
  if (depth === 1) return letters(count, true);
  if (depth === 2) return String(count);
  if (depth === 3) return letters(count, false);
  return String(count);
}

type Line = { text: string; from: number; to: number };

function linesOf(text: string): Line[] {
  const lines: Line[] = [];
  let at = 0;
  for (const text_ of text.split('\n')) {
    lines.push({ text: text_, from: at, to: at + text_.length });
    at += text_.length + 1;
  }
  return lines;
}

/** True for a "# Title" on the sheet's first non-empty line: that's the sheet's name, not a section. */
function titleLine(lines: Line[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.text.trim()) return /^#\s+\S/.test(lines[i]!.text) ? i : -1;
  }
  return -1;
}

export function outlineOf(text: string): Heading[] {
  const lines = linesOf(text);
  const skip = titleLine(lines);
  const found: { level: number; title: string; line: number }[] = [];
  lines.forEach((line, i) => {
    if (i === skip) return;
    const m = line.text.match(HEADING);
    if (m) found.push({ level: m[1]!.length, title: (m[2] ?? '').trim(), line: i });
  });
  if (found.length === 0) return [];

  const top = Math.min(...found.map((h) => h.level));
  // Depth counts the levels actually used, so "##" then "####" reads as two steps, not three.
  const used = [...new Set(found.map((h) => h.level))].sort((a, b) => a - b);
  const counts: number[] = [];
  return found.map((h, i) => {
    const depth = used.indexOf(h.level);
    counts[depth] = (counts[depth] ?? 0) + 1;
    counts.length = depth + 1;
    const next = found.slice(i + 1).find((other) => other.level <= h.level);
    const end = next ? lines[next.line]!.from : text.length;
    return {
      level: h.level,
      title: h.title,
      depth,
      number: label(depth, counts[depth]!),
      line: h.line,
      from: lines[h.line]!.from,
      to: end,
      topLevel: top,
    } satisfies Heading & { topLevel: number };
  });
}

/** The text of a section: its heading line and everything under it. */
export function sectionText(text: string, heading: Heading): string {
  return text.slice(heading.from, heading.to);
}

/** Renames heading `index`, leaving its writing alone. */
export function renameHeading(text: string, index: number, title: string): string {
  const outline = outlineOf(text);
  const heading = outline[index];
  if (!heading) return text;
  const lines = linesOf(text);
  const line = lines[heading.line]!;
  const clean = title.replace(/[\r\n]+/g, ' ').replace(/^#+\s*/, '').trim();
  return text.slice(0, line.from) + `${'#'.repeat(heading.level)} ${clean}`.replace(/ +$/, ' ') + text.slice(line.to);
}

/**
 * Adds a section after `index` (or at the very end when `index` is null), at
 * the same level unless `level` says otherwise. Returns the text and where the
 * new heading sits, so the editor can put the cursor in it.
 */
export function insertSection(text: string, index: number | null, title = '', level?: number): { text: string; at: number } {
  const outline = outlineOf(text);
  const after = index === null ? undefined : outline[index];
  const useLevel = level ?? after?.level ?? (outline[0]?.level || 2);
  const heading = `${'#'.repeat(Math.min(6, Math.max(2, useLevel)))} ${title}`.replace(/ +$/, ' ');
  if (!after) {
    const body = text.replace(/\s*$/, '');
    const start = body ? `${body}\n\n` : '';
    return { text: `${start}${heading}\n`, at: start.length };
  }
  const before = text.slice(0, after.to).replace(/\s*$/, '');
  const rest = text.slice(after.to).replace(/^\s*/, '');
  const at = before.length + 2;
  return { text: `${before}\n\n${heading}\n\n${rest}`, at };
}

/** Moves a section (with its writing and anything nested under it) up or down among its own kind. */
export function moveSection(text: string, index: number, direction: 'up' | 'down'): string {
  const outline = outlineOf(text);
  const heading = outline[index];
  if (!heading) return text;
  const sibling =
    direction === 'up'
      ? [...outline.slice(0, index)].reverse().find((h) => h.level <= heading.level)
      : outline.slice(index + 1).find((h) => h.level <= heading.level);
  // A shallower neighbour is its parent or the next parent: it has nowhere to go.
  if (!sibling || sibling.level !== heading.level) return text;
  const [first, second] = direction === 'up' ? [sibling, heading] : [heading, sibling];
  const firstText = text.slice(first.from, first.to);
  const secondText = text.slice(second.from, second.to);
  const gap = text.slice(first.to, second.from);
  return text.slice(0, first.from) + secondText + gap + firstText + text.slice(second.to);
}

/** Takes a section out (its writing and anything nested with it) and hands back both halves. */
export function removeSection(text: string, index: number): { text: string; removed: string } {
  const outline = outlineOf(text);
  const heading = outline[index];
  if (!heading) return { text, removed: '' };
  const before = text.slice(0, heading.from).replace(/\s*$/, '');
  const after = text.slice(heading.to).replace(/^\s*/, '');
  const joined = before && after ? `${before}\n\n${after}` : before || after;
  return { text: joined ? `${joined}\n` : '', removed: text.slice(heading.from, heading.to).trim() };
}

/** Indents (or outdents) a section and everything nested under it. */
export function changeLevel(text: string, index: number, delta: 1 | -1): string {
  const outline = outlineOf(text);
  const heading = outline[index];
  if (!heading) return text;
  const inSection = outline.filter((h) => h.from >= heading.from && h.to <= heading.to);
  const levels = inSection.map((h) => h.level + delta);
  if (levels.some((l) => l < 2 || l > 6)) return text;
  // Outdenting past the section above would leave the outline crooked.
  const before = outline[index - 1];
  if (delta === 1 && before && heading.level + 1 > before.level + 1) return text;
  const lines = linesOf(text);
  let out = text;
  // Back to front, so earlier offsets stay put.
  for (const h of [...inSection].reverse()) {
    const line = lines[h.line]!;
    out = out.slice(0, line.from) + `${'#'.repeat(h.level + delta)} ${h.title}`.replace(/ +$/, ' ') + out.slice(line.to);
  }
  return out;
}
