// Sprint mode: keep going forward. While it's on, everything before the
// sentence you're writing is locked: the cursor can't be clicked or arrowed
// back into it, and backspace stops at the start of the sentence. The lock
// only ever moves forward, and locked text fades. Nothing is ever lost.

import { Compartment, EditorSelection, EditorState, RangeSetBuilder, StateField, type Extension, Transaction } from '@codemirror/state';
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

/** Everything before this position is locked. It starts where the cursor is and only moves forward. */
export const sprintLock = StateField.define<number>({
  create: (state) => sentenceStart(state, state.selection.main.head),
  update(lock, tr) {
    const mapped = tr.changes.mapPos(lock, -1);
    return Math.max(mapped, sentenceStart(tr.state, tr.state.selection.main.head));
  },
});

/** Your own typing, deleting, cutting and undoing; formatting buttons only add marks. */
const WRITING = ['input.type', 'input.paste', 'input.drop', 'input.complete', 'input.replace', 'delete', 'undo', 'redo', 'move'];

/** Rejects edits to locked text, and keeps the cursor out of it. */
const forwardOnly = EditorState.transactionFilter.of((tr: Transaction) => {
  if (tr.annotation(External)) return tr;
  const lock = tr.startState.field(sprintLock, false);
  if (lock === undefined) return tr;
  if (tr.docChanged && WRITING.some((e) => tr.isUserEvent(e))) {
    let reachesBack = false;
    tr.changes.iterChanges((fromA) => {
      if (fromA < lock) reachesBack = true;
    });
    if (reachesBack) return [];
  }
  // A click or arrow into locked text leaves the cursor where it was;
  // a selection reaching into it (like select-all) is trimmed to the lock.
  if (!tr.selection || tr.docChanged) return tr;
  const sel = tr.selection;
  if (sel.ranges.every((r) => r.from >= lock)) return tr;
  if (sel.ranges.every((r) => r.empty)) return { effects: tr.effects };
  const clamped = EditorSelection.create(
    sel.ranges.map((r) => EditorSelection.range(Math.max(r.anchor, lock), Math.max(r.head, lock))),
    sel.mainIndex,
  );
  return { selection: clamped, effects: tr.effects, scrollIntoView: tr.scrollIntoView, userEvent: tr.annotation(Transaction.userEvent) };
});

const faded = Decoration.line({ class: 'cm-sprint-faded' });

function fadeAbove(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const lock = view.state.field(sprintLock, false) ?? view.state.selection.main.head;
  const current = view.state.doc.lineAt(lock).number;
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
  sprintLock,
  forwardOnly,
  fading,
  EditorView.baseTheme({ '.cm-sprint-faded': { opacity: '0.28', transition: 'opacity 0.3s' } }),
];
