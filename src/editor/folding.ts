// Folding sections: a small arrow just left of each "##" (and smaller)
// heading folds away everything up to the next heading of the same level.
// The top "#" title doesn't get one; folding it would hide the whole sheet.
// What's folded is remembered on this device, by the headings' text.

import { codeFolding, foldEffect, foldable, foldedRanges, foldKeymap, unfoldEffect } from '@codemirror/language';
import { RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view';

const SECTION_HEADING = /^#{2,6}\s+\S/;

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
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (SECTION_HEADING.test(line.text)) {
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
  // ⌥⌘[ folds the section you're in, ⌥⌘] shows it again.
  keymap.of(foldKeymap),
  EditorView.baseTheme({
    '.cm-fold-arrow': { display: 'inline-block', position: 'relative', width: '0' },
    '.cm-fold-arrow svg': { position: 'absolute', left: '-1.45em', top: '-0.8em', color: 'var(--muted)', cursor: 'pointer', padding: '2px', boxSizing: 'content-box' },
    '.cm-fold-arrow:hover svg': { color: 'var(--accent)' },
    '.cm-fold-dots': { color: 'var(--muted)', cursor: 'pointer', padding: '0 0.3em', borderRadius: '4px', background: 'var(--hover)' },
  }),
];
