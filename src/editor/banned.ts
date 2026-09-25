// The banned-word nudge: a soft underline under any word on your list, drawn
// as you write. It never changes, blocks or removes anything — the tally under
// the sheet does the nagging.

import { Compartment, RangeSetBuilder, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { bannedPattern } from '../text/banned';

/** Lets the editor turn the nudge on and off, and follow changes to the list. */
export const bannedSlot = new Compartment();

const mark = Decoration.mark({ class: 'cm-banned' });

function underline(view: EditorView, pattern: RegExp): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      if (m.index === undefined) continue;
      builder.add(from + m.index, from + m.index + m[0].length, mark);
    }
  }
  return builder.finish();
}

/** Underlines every word on `words`. An empty list draws nothing. */
export function bannedWords(words: string[]): Extension {
  const found = bannedPattern(words);
  if (!found) return [];
  const pattern = found;
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = underline(view, pattern);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) this.decorations = underline(update.view, pattern);
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.baseTheme({
      '.cm-banned': {
        textDecoration: 'underline wavy',
        textDecorationColor: 'color-mix(in srgb, var(--danger) 65%, transparent)',
        textDecorationThickness: '1px',
        textUnderlineOffset: '3px',
      },
    }),
  ];
}
