import { useEffect, useRef, type RefObject } from 'react';
import { foldEffect, unfoldEffect } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { prefs } from '../app/device';
import { foldedHeadings, refold } from './folding';
import { sprint, sprintSlot } from './sprint';
import { External, createEditorState } from './setup';
import { typewriter, typewriterSlot } from './typewriter';

type Props = {
  sheetKey: string;
  /** Stays the same through renames; folds are remembered under it. */
  foldKey: string;
  text: string;
  readOnly: boolean;
  typewriterMode: boolean;
  sprintMode: boolean;
  onChange: (text: string) => void;
  onFocusChange: (focused: boolean) => void;
  /** The selected text, or "" when nothing is selected. */
  onSelectionChange: (selected: string) => void;
  viewRef: RefObject<EditorView | null>;
};

type Folds = Record<string, string[]>;

export function Editor({ sheetKey, foldKey, text, readOnly, typewriterMode, sprintMode, onChange, onFocusChange, onSelectionChange, viewRef }: Props) {
  const parent = useRef<HTMLDivElement>(null);
  // Latest callbacks, so the editor doesn't need rebuilding when they change.
  const callbacks = useRef({ onChange, onFocusChange, onSelectionChange, foldKey });
  callbacks.current = { onChange, onFocusChange, onSelectionChange, foldKey };

  const makeState = (doc: string) =>
    createEditorState(
      doc,
      readOnly,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(External))) {
          callbacks.current.onChange(update.state.doc.toString());
        }
        if (update.focusChanged) callbacks.current.onFocusChange(update.view.hasFocus);
        if (update.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)))) {
          const folds = prefs.get<Folds>('folds', {});
          const headings = foldedHeadings(update.state);
          if (headings.length) folds[callbacks.current.foldKey] = headings;
          else delete folds[callbacks.current.foldKey];
          prefs.set('folds', folds);
        }
        if (update.selectionSet || update.docChanged) {
          const { from, to } = update.state.selection.main;
          callbacks.current.onSelectionChange(update.state.sliceDoc(from, to));
        }
      }),
      typewriterMode,
    );

  useEffect(() => {
    const view = new EditorView({ parent: parent.current!, state: makeState(text) });
    viewRef.current = view;
    refold(view, prefs.get<Folds>('folds', {})[foldKey] ?? []);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is created once; sheet changes swap its state below.
  }, []);

  // A different sheet (or read-only mode): start a fresh editing session.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setState(makeState(text));
    refold(view, prefs.get<Folds>('folds', {})[foldKey] ?? []);
  }, [sheetKey, readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: typewriterSlot.reconfigure(typewriterMode ? typewriter : []) });
  }, [typewriterMode, viewRef]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: sprintSlot.reconfigure(sprintMode ? sprint : []) });
  }, [sprintMode, viewRef]);

  // The text changed from outside (a sync brought a newer version): show it.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === text) return;
    const head = Math.min(view.state.selection.main.head, text.length);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: head },
      annotations: External.of(true),
    });
  }, [text, viewRef]);

  return <div className="editor-host" ref={parent} />;
}
