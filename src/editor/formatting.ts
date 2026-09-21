// The formatting toolbar and shortcuts. Each command only types Markdown for
// you: the file stays plain text.

import { EditorSelection, type StateCommand, type Text } from '@codemirror/state';

/** Wraps the selection in `mark` (e.g. "**"), or unwraps it if it's already wrapped. */
export function toggleWrap(mark: string): StateCommand {
  return ({ state, dispatch }) => {
    const n = mark.length;
    const tr = state.changeByRange((range) => {
      const doc = state.doc;
      const before = doc.sliceString(Math.max(0, range.from - n), range.from);
      const after = doc.sliceString(range.to, range.to + n);
      // Italic "*" shouldn't mistake the edge of bold "**" for its own mark
      // (but "***word***" is bold and italic, so its inner "*" counts).
      const boldEdge =
        mark === '*' &&
        doc.sliceString(Math.max(0, range.from - 2), range.from) === '**' &&
        doc.sliceString(range.to, range.to + 2) === '**' &&
        doc.sliceString(Math.max(0, range.from - 3), range.from) !== '***';
      const wrapped = before === mark && after === mark && !boldEdge;
      if (wrapped) {
        return {
          changes: [
            { from: range.from - n, to: range.from },
            { from: range.to, to: range.to + n },
          ],
          range: EditorSelection.range(range.from - n, range.to - n),
        };
      }
      const inner = doc.sliceString(range.from, range.to);
      if (inner.length >= 2 * n && inner.startsWith(mark) && inner.endsWith(mark)) {
        return {
          changes: { from: range.from, to: range.to, insert: inner.slice(n, -n) },
          range: EditorSelection.range(range.from, range.to - 2 * n),
        };
      }
      return {
        changes: [
          { from: range.from, insert: mark },
          { from: range.to, insert: mark },
        ],
        range: EditorSelection.range(range.from + n, range.to + n),
      };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
    return true;
  };
}

function linesOf(doc: Text, from: number, to: number) {
  const lines = [];
  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos);
    lines.push(line);
    pos = line.to + 1;
  }
  return lines;
}

/** Changes the start of every selected line, keeping the selection in place. */
function editLineStarts(edit: (text: string, allHave: boolean) => { remove: number; insert: string }, has: (text: string) => boolean): StateCommand {
  return ({ state, dispatch }) => {
    const tr = state.changeByRange((range) => {
      const lines = linesOf(state.doc, range.from, range.to);
      const allHave = lines.every((l) => has(l.text));
      const changes = lines.map((l) => {
        const { remove, insert } = edit(l.text, allHave);
        return { from: l.from, to: l.from + remove, insert };
      });
      const set = state.changes(changes);
      return { changes: set, range: EditorSelection.range(set.mapPos(range.anchor, 1), set.mapPos(range.head, 1)) };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
    return true;
  };
}

const HEADING = /^#{1,6}\s+/;

/** Makes the lines a heading of `level`, or plain text if they already are one. */
export function toggleHeading(level: number): StateCommand {
  const hashes = '#'.repeat(level) + ' ';
  const isThisLevel = (t: string) => (t.match(HEADING)?.[0].trim().length ?? 0) === level;
  return editLineStarts((text, allHave) => {
    const existing = text.match(HEADING)?.[0].length ?? 0;
    return { remove: existing, insert: allHave ? '' : hashes };
  }, isThisLevel);
}

/** Adds `prefix` (like "> " or "- ") to the lines, or removes it if every line has it. */
export function toggleLinePrefix(prefix: string): StateCommand {
  const has = (t: string) => t.startsWith(prefix);
  return editLineStarts((text, allHave) => (allHave ? { remove: prefix.length, insert: '' } : has(text) ? { remove: 0, insert: '' } : { remove: 0, insert: prefix }), has);
}

/** Turns the selection into a link and puts the cursor where the address goes. */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const tr = state.changeByRange((range) => {
    const label = state.doc.sliceString(range.from, range.to);
    const insert = `[${label}]()`;
    const cursor = range.from + label.length + 3;
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(label ? cursor : range.from + 1) };
  });
  dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

/**
 * Turns the selection into a comment (<!-- … -->), which doesn't count as
 * words. With the cursor inside a comment, or a comment selected, it unwraps it.
 */
export const toggleComment: StateCommand = ({ state, dispatch }) => {
  const doc = state.doc.toString();
  const tr = state.changeByRange((range) => {
    // A comment around the cursor or selection?
    const open = doc.lastIndexOf('<!--', range.from);
    const close = open < 0 ? -1 : doc.indexOf('-->', open + 4);
    if (open >= 0 && close >= 0 && close + 3 >= range.to && !doc.slice(open, range.from).includes('-->')) {
      const innerStart = open + 4 + (doc[open + 4] === ' ' ? 1 : 0);
      const innerEnd = close - (doc[close - 1] === ' ' && close - 1 >= innerStart ? 1 : 0);
      const changes = state.changes([
        { from: open, to: innerStart },
        { from: innerEnd, to: close + 3 },
      ]);
      return { changes, range: EditorSelection.range(changes.mapPos(range.anchor, -1), changes.mapPos(range.head, -1)) };
    }
    const text = doc.slice(range.from, range.to);
    const insert = `<!-- ${text} -->`;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: text ? EditorSelection.range(range.from, range.from + insert.length) : EditorSelection.cursor(range.from + 5),
    };
  });
  dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

export const bold = toggleWrap('**');
export const italic = toggleWrap('*');
export const quote = toggleLinePrefix('> ');
export const bulletList = toggleLinePrefix('- ');
