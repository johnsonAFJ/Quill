// Typewriter mode: the line you're typing stays in the middle of the screen,
// so your eyes stay in one place. Typing, deleting, undo and the arrow keys
// re-center it; clicking somewhere with the mouse doesn't jump the page.

import { Compartment, EditorState, Prec, type Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Lets the editor switch typewriter mode on and off without starting over. */
export const typewriterSlot = new Compartment();

const recenters = (tr: Transaction) =>
  ['input', 'delete', 'undo', 'redo', 'move'].some((e) => tr.isUserEvent(e)) || (tr.isUserEvent('select') && !tr.isUserEvent('select.pointer'));

export const typewriter = [
  // Rides along with each keystroke, so it works without waiting for a screen refresh.
  EditorState.transactionExtender.of((tr) =>
    tr.selection && recenters(tr) ? { effects: EditorView.scrollIntoView(tr.selection.main.head, { y: 'center' }) } : null,
  ),
  // Room above the first line, so even the top of a sheet can sit in the middle.
  // It has to win over the editor's usual spacing.
  Prec.highest(EditorView.theme({ '.cm-content': { paddingTop: '40vh' } })),
];
