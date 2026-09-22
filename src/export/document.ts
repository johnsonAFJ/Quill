// Turning a sheet into what goes on the page: its title, its body as HTML,
// and its word count. Comments (<!-- prompts and asides -->) never make it
// into an export, and neither do notes, which live in a separate file.

import { Marked, type Tokens } from 'marked';
import { titleOf, withoutComments, wordCount } from '../text/markdown';

export type ExportDoc = { title: string; bodyHtml: string; words: number };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** For text inside a CSS content: "…" string, like the manuscript page header. */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

const markdown = new Marked({ gfm: true }).use({
  renderer: {
    // HTML typed into a sheet is shown as text, never run.
    html: (token: Tokens.HTML | Tokens.Tag) => escapeHtml(token.text),
    // "***", "---" or "* * *" between scenes.
    hr: () => '<p class="scene-break" aria-hidden="true"></p>\n',
  },
});

/**
 * If the sheet starts with a heading, that heading is the title and the text
 * below it is the body. Otherwise the whole sheet is the body and its name
 * (`fallbackTitle`) is the title, so no opening sentence is ever lost.
 */
export function exportDocument(text: string, fallbackTitle: string): ExportDoc {
  const clean = withoutComments(text).replace(/\r\n/g, '\n');
  const lines = clean.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  const heading = first >= 0 && /^\s{0,3}#{1,6}\s+\S/.test(lines[first]!);
  const title = heading ? titleOf(lines[first]!) : fallbackTitle;
  const body = heading ? lines.slice(first + 1).join('\n') : clean;
  return { title, bodyHtml: markdown.parse(body.trim(), { async: false }), words: wordCount(body) };
}

/**
 * The count on a manuscript's first page. Rounded by convention ("about
 * 2,300 words"); exact when a market's guidelines ask for it or a word limit
 * is close.
 */
export function manuscriptWords(words: number, round = true): string {
  if (!round || words < 100) return `${words.toLocaleString('en-US')} word${words === 1 ? '' : 's'}`;
  return `about ${(Math.round(words / 100) * 100).toLocaleString('en-US')} words`;
}
