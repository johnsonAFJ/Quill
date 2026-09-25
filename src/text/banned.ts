// Banned words: your own list of the words you lean on too hard. Quill never
// stops you typing one — it underlines it as you pass and keeps a tally at the
// foot of the sheet, so you can't pretend you didn't notice.
//
// The list is an ordinary sheet in your Quill folder, one word or phrase a
// line, so you can add to it from any device.

import { withoutComments } from './markdown';

export const BANNED_PATH = '/_Banned words.md';

export const STARTER_LIST = `# Banned words

One word or phrase a line. While the nudge is on (••• → Banned words), Quill
underlines these as you write and counts them under your sheet. It never stops
you typing, changes your writing or touches sheets you've already finished.

- very
- really
- just
- suddenly
- somehow
- literally
- actually
- started to
- began to
- in order to
`;

/**
 * The words on the list: one a line, "- " optional. Headings, blanks and
 * ordinary sentences are left out, so you can keep notes to yourself in the
 * same file — anything with a full stop, or longer than a short phrase, is
 * treated as prose rather than as a word you're banning.
 */
export function parseBannedList(file: string | undefined): string[] {
  if (!file) return [];
  const words: string[] = [];
  for (const raw of withoutComments(file).split('\n')) {
    const bullet = /^\s*[-*+]\s+/.test(raw);
    const line = raw.replace(/^\s*[-*+]\s+/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith('>')) continue;
    const prose = !bullet && (/[.!?:]$/.test(line) || line.split(/\s+/).length > 4);
    if (prose) continue;
    words.push(line.replace(/[.,;:!?]+$/, '').toLowerCase());
  }
  return [...new Set(words)];
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One expression that finds every word on the list. Whole words only, so
 * "just" doesn't light up inside "adjust"; a phrase may have any spacing.
 */
export function bannedPattern(words: string[]): RegExp | null {
  if (words.length === 0) return null;
  const parts = [...words].sort((a, b) => b.length - a.length).map((w) => escape(w).replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}'’])(${parts.join('|')})(?![\\p{L}\\p{N}'’])`, 'giu');
}

export type Tally = { word: string; count: number };

/** How many of each list word the writing holds, most-used first. Comments don't count. */
export function tallyBanned(text: string, words: string[]): Tally[] {
  const pattern = bannedPattern(words);
  if (!pattern) return [];
  const counts = new Map<string, number>();
  for (const m of withoutComments(text).matchAll(pattern)) {
    const word = m[1]!.toLowerCase().replace(/\s+/g, ' ');
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** "just ×4 · really ×2", for the line under the sheet. */
export function tallyLabel(tally: Tally[], most = 3): string {
  return tally
    .slice(0, most)
    .map((t) => `${t.word} ×${t.count}`)
    .join(' · ');
}
