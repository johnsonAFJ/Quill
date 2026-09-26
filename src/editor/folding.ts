// Folding sections: a small arrow just left of each heading folds away
// everything up to the next heading of the same level. The sheet's title
// (a "#" heading on its first line) doesn't get one; folding it would hide
// the whole sheet.
// What's folded is remembered on this device, by the headings' text.

import { codeFolding, foldEffect, foldable, foldedRanges, foldKeymap, unfoldEffect } from '@codemirror/language';
import { Prec, RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view';

const HEADING = /^#{1,6}\s+\S/;

/** The line number of the sheet's title, if it starts with a "#" heading. */
function titleLine(state: EditorState): number {
  for (let i = 1; i <= state.doc.lines; i++) {
    const text = state.doc.line(i).text;
    if (text.trim()) return /^#\s/.test(text) ? i : 0;
  }
  return 0;
}

class FoldArrow extends WidgetType {
  constructor(readonly folded: boolean, readonly pos: number) {
    super();
  }
  eq(other: FoldArrow) {
    return other.folded === this.folded && other.pos === this.pos;
  }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-fold-arrow';
    wrap.dataset.pos = String(this.pos);
    wrap.setAttribute('aria-label', this.folded ? 'Show section' : 'Fold section');
    wrap.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${this.folded ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'}"/></svg>`;
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

function isFolded(state: EditorState, from: number, to: number): boolean {
  let found = false;
  foldedRanges(state).between(from, to, (a, b) => {
    if (a === from && b === to) found = true;
  });
  return found;
}

function arrows(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const title = titleLine(view.state);
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== title && HEADING.test(line.text)) {
        const range = foldable(view.state, line.from, line.to);
        if (range) builder.add(line.from, line.from, Decoration.widget({ widget: new FoldArrow(isFolded(view.state, range.from, range.to), line.from), side: -1 }));
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const arrowPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = arrows(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)))) {
        this.decorations = arrows(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const arrow = (event.target as HTMLElement).closest<HTMLElement>('.cm-fold-arrow');
        if (!arrow) return false;
        event.preventDefault();
        toggleAt(view, Number(arrow.dataset.pos));
        return true;
      },
    },
  },
);

function toggleAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const range = foldable(view.state, line.from, line.to);
  if (!range) return;
  view.dispatch({ effects: isFolded(view.state, range.from, range.to) ? unfoldEffect.of(range) : foldEffect.of(range) });
}

/**
 * The section the cursor is in: the nearest heading at or above it (not the
 * sheet's title) whose section reaches down to the cursor.
 */
export function sectionAt(state: EditorState, pos: number): { from: number; to: number; heading: number } | null {
  const title = titleLine(state);
  for (let n = state.doc.lineAt(pos).number; n >= 1; n--) {
    if (n === title) return null;
    const line = state.doc.line(n);
    if (!HEADING.test(line.text)) continue;
    const range = foldable(state, line.from, line.to);
    if (range && pos <= range.to) return { ...range, heading: line.from };
  }
  return null;
}

/** ⌥⌘[: fold the section you're in down to its heading, wherever the cursor is in it. */
export function foldSection(view: EditorView): boolean {
  const section = sectionAt(view.state, view.state.selection.main.head);
  if (!section || isFolded(view.state, section.from, section.to)) return false;
  view.dispatch({
    effects: foldEffect.of({ from: section.from, to: section.to }),
    // The cursor waits at the end of the heading, ready to open it again.
    selection: { anchor: section.from },
  });
  return true;
}

/** ⌥⌘]: open the folded section you're on (or in) again. */
export function unfoldSection(view: EditorView): boolean {
  const state = view.state;
  const line = state.doc.lineAt(state.selection.main.head);
  let found: { from: number; to: number } | null = null;
  foldedRanges(state).between(line.from, line.to + 1, (from, to) => {
    found ??= { from, to };
  });
  if (!found) {
    const section = sectionAt(state, state.selection.main.head);
    if (section && isFolded(state, section.from, section.to)) found = { from: section.from, to: section.to };
  }
  if (!found) return false;
  view.dispatch({ effects: unfoldEffect.of(found) });
  return true;
}

/**
 * The fold keys, recognised by the physical key. With ⌥ held, a Mac types "“"
 * and "‘" for [ and ], so a keymap listening for "[" never hears them.
 */
const foldKeys = Prec.high(
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (!event.altKey || !(event.metaKey || event.ctrlKey) || event.shiftKey) return false;
      const run = event.code === 'BracketLeft' ? foldSection : event.code === 'BracketRight' ? unfoldSection : null;
      if (!run) return false;
      event.preventDefault();
      run(view);
      return true;
    },
  }),
);

/** The heading lines of every folded section, to remember what's folded. */
export function foldedHeadings(state: EditorState): string[] {
  const headings: string[] = [];
  foldedRanges(state).between(0, state.doc.length, (from) => {
    headings.push(state.doc.lineAt(from).text);
  });
  return headings;
}

/** Folds the sections whose heading lines are in `headings`. */
export function refold(view: EditorView, headings: string[]): void {
  if (headings.length === 0) return;
  const wanted = new Set(headings);
  const effects = [];
  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    if (!wanted.has(line.text)) continue;
    const range = foldable(view.state, line.from, line.to);
    if (range) effects.push(foldEffect.of(range));
  }
  if (effects.length) view.dispatch({ effects });
}

export const sectionFolding: Extension = [
  codeFolding({
    placeholderDOM: (_view, onclick) => {
      const dots = document.createElement('span');
      dots.className = 'cm-fold-dots';
      dots.textContent = '…';
      dots.title = 'Show section';
      dots.onclick = onclick;
      return dots;
    },
  }),
  arrowPlugin,
  // ⌥⌘[ folds the section you're in, ⌥⌘] shows it again (see foldKeys).
  foldKeys,
  keymap.of(foldKeymap),
  EditorView.baseTheme({
    '.cm-fold-arrow': { display: 'inline-block', position: 'relative', width: '0' },
    '.cm-fold-arrow svg': { position: 'absolute', left: '-1.45em', top: '-0.8em', color: 'var(--muted)', cursor: 'pointer', padding: '2px', boxSizing: 'content-box' },
    '.cm-fold-arrow:hover svg': { color: 'var(--accent)' },
    '.cm-fold-dots': { color: 'var(--muted)', cursor: 'pointer', padding: '0 0.3em', borderRadius: '4px', background: 'var(--hover)' },
  }),
];
