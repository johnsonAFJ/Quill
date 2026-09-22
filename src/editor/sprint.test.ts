import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { sentenceStart, sprint } from './sprint';

const DOC = 'The tide went out. It kept going! Nobody knew why';

/** Tries a user edit replacing from..to with `insert`; returns the text afterwards. */
function tryEdit(doc: string, cursor: number, from: number, to: number, insert: string, userEvent: string) {
  const state = EditorState.create({ doc, selection: EditorSelection.cursor(cursor), extensions: sprint });
  return state.update({ changes: { from, to, insert }, userEvent }).state.doc.toString();
}

describe('sentenceStart', () => {
  const state = EditorState.create({ doc: 'First line.\n' + DOC });
  const base = 'First line.\n'.length;
  it('finds the start of the sentence the cursor is in', () => {
    expect(sentenceStart(state, base + DOC.length)).toBe(base + DOC.indexOf('Nobody'));
    expect(sentenceStart(state, base + DOC.indexOf('kept'))).toBe(base + DOC.indexOf('It kept'));
    expect(sentenceStart(state, base + 5)).toBe(base);
  });
});

describe('sprint mode', () => {
  const end = DOC.length;
  const nobody = DOC.indexOf('Nobody');

  it('lets you backspace within the current sentence', () => {
    expect(tryEdit(DOC, end, end - 3, end, '', 'delete.backward')).toBe('The tide went out. It kept going! Nobody knew ');
  });

  it('won’t let backspace reach into an earlier sentence', () => {
    expect(tryEdit(DOC, nobody, nobody - 1, nobody, '', 'delete.backward')).toBe(DOC);
    expect(tryEdit(DOC, end, 0, end, '', 'delete.selection')).toBe(DOC);
  });

  it('won’t let you type over earlier text either', () => {
    expect(tryEdit(DOC, end, 4, 8, 'sea', 'input.type')).toBe(DOC);
  });

  it('always lets you keep typing', () => {
    expect(tryEdit(DOC, end, end, end, '.', 'input.type')).toBe(DOC + '.');
  });

  it('never blocks changes arriving from Dropbox or formatting', () => {
    expect(tryEdit(DOC, end, 0, 3, 'A', 'input.format')).toBe('A tide went out. It kept going! Nobody knew why');
  });
});
