// Your prompt list: one Markdown file, _Prompts.md, in the Quill folder.
//
//   - A prompt waiting to be used
//   - [ ] Another one (a checkbox is fine too)
//   - [x] 2026-09-22 · A prompt Quill already gave you
//
// A prompt can also carry a title and some direction, still on one line:
//
//   - **The Wrong Recording** — What to write. Vibe: … Anchor: … Aim: …
//
// Any unticked list item is unused. Quill ticks a prompt and moves it under
// "## Used" the moment it gives it to you, and because that's written in the
// file, every device knows. Everything else in the file is left as you wrote it.

export const PROMPTS_PATH = '/_Prompts.md';

const ITEM = /^\s*[-*+]\s+(?:\[( |x|X)\]\s+)?(.*\S)\s*$/;
const USED_HEADING = /^##\s+Used\s*$/im;
const BATCH_MARK = /<!-- Quill has added its prompt batches up to (\d+)\. -->/;

export type Prompt = { text: string; line: number };

export function unusedPrompts(file: string): Prompt[] {
  const prompts: Prompt[] = [];
  file.split('\n').forEach((line, i) => {
    const m = line.match(ITEM);
    if (m && !m[1]?.trim()) prompts.push({ text: m[2]!, line: i });
  });
  return prompts;
}

export function usedCount(file: string): number {
  return file.split('\n').filter((line) => line.match(ITEM)?.[1]?.trim()).length;
}

/** Ticks off the prompt on `line`, moving it under "## Used" with the date. */
export function markUsed(file: string, prompt: Prompt, date: Date): string {
  const lines = file.split('\n');
  if (lines[prompt.line]?.match(ITEM)?.[2] !== prompt.text) return file; // the list changed; leave it alone
  lines.splice(prompt.line, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const used = `- [x] ${day} · ${prompt.text}`;
  const heading = lines.findIndex((l) => USED_HEADING.test(l));
  if (heading === -1) {
    // Before the batch marker, if there is one, so it stays last.
    const mark = lines.findIndex((l) => BATCH_MARK.test(l));
    const at = mark === -1 ? lines.length : mark;
    const before = lines.slice(0, at);
    while (before.length && !before[before.length - 1]!.trim()) before.pop();
    return [...before, '', '## Used', used, '', ...lines.slice(at)].join('\n');
  }
  lines.splice(heading + 1, 0, used);
  return lines.join('\n');
}

/** A random unused prompt. Ones with a title and direction come first, while any are left. */
export function pickPrompt(file: string, random: () => number = Math.random): Prompt | null {
  const unused = unusedPrompts(file);
  const directed = unused.filter((p) => promptParts(p.text).title);
  const prompts = directed.length ? directed : unused;
  return prompts.length ? prompts[Math.floor(random() * prompts.length)]! : null;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Every prompt text in the file, used or not. */
function knownPrompts(file: string): Set<string> {
  const known = new Set<string>();
  for (const line of file.split('\n')) {
    const text = line.match(ITEM)?.[2];
    if (text) known.add(normalize(text.replace(/^\d{4}-\d{2}-\d{2} · /, '')));
  }
  return known;
}

/** A fresh prompt file with Quill's prompts. */
export function newPromptFile(batches: string[][]): string {
  return mergeBatches(
    `# Prompts

Quill gives you a random prompt from this list and moves it to "Used", so you never get the same one twice. Add your own anywhere above "Used", one per line, starting with "- ". Delete any you don't like.

`,
    batches,
  );
}

/**
 * Adds prompts from batches newer than the file has seen, skipping any already
 * in the file. A prompt you deleted stays deleted: its batch was already added.
 */
export function mergeBatches(file: string, batches: string[][]): string {
  const upTo = Number(file.match(BATCH_MARK)?.[1] ?? 0);
  if (upTo >= batches.length) return file;
  const known = knownPrompts(file);
  const fresh = batches
    .slice(upTo)
    .flat()
    .filter((p) => !known.has(normalize(p)));
  const mark = `<!-- Quill has added its prompt batches up to ${batches.length}. -->`;
  const lines = file.replace(BATCH_MARK, '').trimEnd().split('\n');
  // New prompts go just above "## Used", or at the end.
  const heading = lines.findIndex((l) => USED_HEADING.test(l));
  const before = lines.slice(0, heading === -1 ? lines.length : heading);
  const after = heading === -1 ? [] : lines.slice(heading);
  while (before.length && !before[before.length - 1]!.trim()) before.pop();
  const items = fresh.map((p) => `- ${p}`);
  // A blank line after any text that isn't itself a prompt.
  const gap = before.length && !ITEM.test(before[before.length - 1]!) ? [''] : [];
  return [...before, ...gap, ...items, ...(after.length ? ['', ...after] : []), '', mark, ''].join('\n');
}

export const DETAIL_LABELS = ['Vibe', 'Anchor', 'Aim'] as const;
export type PromptParts = { title: string | null; body: string; details: { label: string; text: string }[] };

/** Splits "**Title** — body. Vibe: … Anchor: … Aim: …" into its parts. A plain prompt is all body. */
export function promptParts(prompt: string): PromptParts {
  let rest = prompt.trim();
  let title: string | null = null;
  const titled = rest.match(/^\*\*(.+?)\*\*\s*[—–-]\s*/);
  if (titled) {
    title = titled[1]!.trim();
    rest = rest.slice(titled[0].length);
  }
  const labels = new RegExp(`\\s(${DETAIL_LABELS.join('|')}):\\s`, 'g');
  const pieces = (' ' + rest).split(labels);
  const body = pieces[0]!.trim();
  const details: PromptParts['details'] = [];
  for (let i = 1; i + 1 < pieces.length; i += 2) details.push({ label: pieces[i]!, text: pieces[i + 1]!.trim() });
  return { title, body, details };
}

/** The first lines of a new sheet written from a prompt: a comment, so it isn't counted as words. */
export function promptComment(prompt: string): string {
  const { title, body, details } = promptParts(prompt.replace(/-->/g, '—>'));
  if (!title && details.length === 0) return `<!-- Prompt: ${body} -->\n\n`;
  const lines = [`Prompt: ${title ?? body}`, ...(title ? [body] : []), ...details.map((d) => `${d.label}: ${d.text}`)];
  return `<!--\n${lines.join('\n')}\n-->\n\n`;
}
