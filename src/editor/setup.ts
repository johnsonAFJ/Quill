// How the editor looks and behaves: Markdown styled as you type, with the
// symbols (# ** > -) kept visible but faded.

import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, selectLine } from '@codemirror/commands';
import { Annotation, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { bold, bulletList, insertLink, italic, quote, toggleComment, toggleHeading } from './formatting';
import { typewriter, typewriterSlot } from './typewriter';

/** Marks changes that came from Dropbox rather than your typing. */
export const External = Annotation.define<boolean>();

const markdownStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', letterSpacing: '-0.01em' },
  { tag: t.heading2, fontSize: '1.3em', fontWeight: '700' },
  { tag: t.heading3, fontSize: '1.12em', fontWeight: '700' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '700' },
  // The Markdown symbols themselves: # ** _ > - [ ] ( )
  { tag: t.processingInstruction, color: 'var(--mark)', fontWeight: '400' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--mark)' },
  { tag: t.quote, color: 'var(--quote)' },
  { tag: t.monospace, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.88em' },
  { tag: t.contentSeparator, color: 'var(--mark)' },
  // <!-- comments --> are for you, not the reader, and don't count as words.
  { tag: t.comment, color: 'var(--muted)', fontStyle: 'italic' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontFamily: 'var(--writing-font)', fontSize: 'var(--writing-size)', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7', overflowX: 'hidden' },
  '.cm-content': {
    maxWidth: '68ch',
    margin: '0 auto',
    padding: '2rem 1.5rem 45vh',
    caretColor: 'var(--accent)',
  },
  '.cm-line': { padding: '0' },
  '.cm-placeholder': { color: 'var(--muted)', fontStyle: 'italic' },
  '&.cm-editor ::selection, .cm-content ::selection': { backgroundColor: 'var(--selection)' },
});

export const formattingKeys = keymap.of([
  { key: 'Mod-b', run: bold },
  { key: 'Mod-i', run: italic },
  { key: 'Mod-1', run: toggleHeading(1) },
  { key: 'Mod-2', run: toggleHeading(2) },
  { key: 'Mod-3', run: toggleHeading(3) },
  { key: 'Mod-k', run: insertLink },
  { key: "Mod-'", run: quote },
  { key: 'Mod-Shift-8', run: bulletList },
  { key: 'Mod-/', run: toggleComment },
  // Selects the paragraph (in Markdown, one long wrapped line); again adds the next. Ctrl-L does the same.
  { key: 'Mod-l', run: selectLine, preventDefault: true },
]);

export function createEditorState(text: string, readOnly: boolean, listeners: Extension, typewriterOn = false): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      // Files written with Windows line endings keep them.
      text.includes('\r\n') ? EditorState.lineSeparator.of('\r\n') : [],
      history(),
      formattingKeys,
      keymap.of([...historyKeymap, ...defaultKeymap]),
      markdown(),
      syntaxHighlighting(markdownStyle),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences' }),
      placeholder(readOnly ? '' : 'Start writing…'),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      theme,
      typewriterSlot.of(typewriterOn ? typewriter : []),
      listeners,
    ],
  });
}
