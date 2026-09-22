// Sprint mode: keep going forward. While it's on, backspace and delete only
// work inside the sentence you're typing, and everything above the current
// paragraph fades, so there's nothing to go back and fiddle with. Typing,
// moving around and formatting all work as usual. Nothing is ever lost.

import { Compartment, EditorState, RangeSetBuilder, type Extension, type Transaction } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { External } from './annotations';

/** Lets the editor turn sprint mode on and off without starting over. */
export const sprintSlot = new Compartment();

/**
 * Where the sentence containing `pos` starts: just after the last ". ", "! ",
 * "? " (quotes and brackets allowed) before it on the same paragraph, or the
 * start of the paragraph.
 */
export function sentenceStart(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  let start = 0;
  for (const m of before.matchAll(/[.!?…]["”’')\]]*\s+/g)) start = m.index + m[0].length;
  return line.from + start;
}

/** Rejects any typing or deleting that would remove text before the current sentence. */
const forwardOnly = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || tr.annotation(External)) return tr;
  // Only your own typing, deleting, cutting and undoing; formatting buttons only add marks.
  if (!['input.type', 'input.paste', 'input.drop', 'input.complete', 'delete', 'undo', 'redo', 'move'].some((e) => tr.isUserEvent(e))) return tr;
  const limit = sentenceStart(tr.startState, tr.startState.selection.main.head);
  let reachesBack = false;
  tr.changes.iterChanges((fromA, toA) => {
    if (toA > fromA && fromA < limit) reachesBack = true;
  });
  return reachesBack ? [] : tr;
});

const faded = Decoration.line({ class: 'cm-sprint-faded' });

function fadeAbove(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const current = view.state.doc.lineAt(view.state.selection.main.head).number;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (line.number < current) builder.add(line.from, line.from, faded);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const fading = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = fadeAbove(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) this.decorations = fadeAbove(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);

export const sprint: Extension = [
  forwardOnly,
  fading,
  EditorView.baseTheme({ '.cm-sprint-faded': { opacity: '0.28', transition: 'opacity 0.3s' } }),
];
