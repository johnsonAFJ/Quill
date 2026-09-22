import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { bold, bulletList, insertLink, italic, quote, toggleComment, toggleHeading } from './formatting';

/** Runs a command on text where "|" marks the cursor or "[" "]" mark a selection. */
function run(command: StateCommand, input: string): string {
  let from = input.indexOf('[');
  let to: number;
  let doc: string;
  if (from >= 0) {
    to = input.indexOf(']') - 1;
    doc = input.replace('[', '').replace(']', '');
  } else {
    from = to = input.indexOf('|');
    doc = input.replace('|', '');
  }
  let state = EditorState.create({ doc, selection: EditorSelection.range(from, to) });
  command({ state, dispatch: (tr) => (state = tr.state) });
  const { from: a, to: b } = state.selection.main;
  const text = state.doc.toString();
  return a === b ? text.slice(0, a) + '|' + text.slice(a) : text.slice(0, a) + '[' + text.slice(a, b) + ']' + text.slice(b);
}

describe('bold and italic', () => {
  it('wraps the selection', () => {
    expect(run(bold, 'a [word] here')).toBe('a **[word]** here');
    expect(run(italic, 'a [word] here')).toBe('a *[word]* here');
  });
  it('unwraps when pressed again', () => {
    expect(run(bold, 'a **[word]** here')).toBe('a [word] here');
    expect(run(italic, 'a *[word]* here')).toBe('a [word] here');
  });
  it('doesn’t confuse bold with italic', () => {
    expect(run(italic, 'a **[word]** here')).toBe('a ***[word]*** here');
  });
  it('places the cursor between marks when nothing is selected', () => {
    expect(run(bold, 'a | here')).toBe('a **|** here');
  });
});

describe('headings', () => {
  it('adds, changes and removes heading levels', () => {
    expect(run(toggleHeading(1), 'Ti|tle')).toBe('# Ti|tle');
    expect(run(toggleHeading(2), '# Ti|tle')).toBe('## Ti|tle');
    expect(run(toggleHeading(2), '## Ti|tle')).toBe('Ti|tle');
  });
});

describe('quotes and lists', () => {
  it('prefixes every selected line and removes the prefix again', () => {
    expect(run(bulletList, '[one\ntwo]')).toBe('- [one\n- two]');
    expect(run(bulletList, '- [one\n- two]')).toBe('[one\ntwo]');
    expect(run(quote, 'a |line')).toBe('> a |line');
  });
});

describe('comments', () => {
  it('wraps the selection in a comment', () => {
    expect(run(toggleComment, '[Prompt: a storm]\n\nText')).toBe('[<!-- Prompt: a storm -->]\n\nText');
  });
  it('unwraps a selected comment, or the one the cursor is in', () => {
    expect(run(toggleComment, '[<!-- Prompt -->] Text')).toBe('[Prompt] Text');
    expect(run(toggleComment, '<!-- Pro|mpt --> Text')).toBe('Pro|mpt Text');
  });
  it('comments out the whole paragraph when nothing is selected', () => {
    expect(run(toggleComment, 'First.\n\nA lo|ng paragraph.\n\nLast.')).toBe('First.\n\n<!-- A lo|ng paragraph. -->\n\nLast.');
    expect(run(toggleComment, '- A list it|em')).toBe('<!-- - A list it|em -->');
  });
  it('unwraps it again with the cursor anywhere inside', () => {
    expect(run(toggleComment, '<!-- A lo|ng paragraph. -->')).toBe('A lo|ng paragraph.');
  });
  it('starts an empty comment on a blank line, or beside an existing comment', () => {
    expect(run(toggleComment, 'a\n|\nb')).toBe('a\n<!-- | -->\nb');
    expect(run(toggleComment, '<!-- a --> b|')).toBe('<!-- a --> b<!-- | -->');
  });
});

describe('links', () => {
  it('wraps the selection and puts the cursor where the address goes', () => {
    expect(run(insertLink, 'see [this] now')).toBe('see [this](|) now');
  });
});
