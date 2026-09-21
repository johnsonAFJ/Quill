import { useEffect, useRef, type RefObject } from 'react';
import { EditorView } from '@codemirror/view';
import { External, createEditorState } from './setup';

type Props = {
  sheetKey: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  onFocusChange: (focused: boolean) => void;
  /** The selected text, or "" when nothing is selected. */
  onSelectionChange: (selected: string) => void;
  viewRef: RefObject<EditorView | null>;
};

export function Editor({ sheetKey, text, readOnly, onChange, onFocusChange, onSelectionChange, viewRef }: Props) {
  const parent = useRef<HTMLDivElement>(null);
  // Latest callbacks, so the editor doesn't need rebuilding when they change.
  const callbacks = useRef({ onChange, onFocusChange, onSelectionChange });
  callbacks.current = { onChange, onFocusChange, onSelectionChange };

  const makeState = (doc: string) =>
    createEditorState(
      doc,
      readOnly,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(External))) {
          callbacks.current.onChange(update.state.doc.toString());
        }
        if (update.focusChanged) callbacks.current.onFocusChange(update.view.hasFocus);
        if (update.selectionSet || update.docChanged) {
          const { from, to } = update.state.selection.main;
          callbacks.current.onSelectionChange(update.state.sliceDoc(from, to));
        }
      }),
    );

  useEffect(() => {
    const view = new EditorView({ parent: parent.current!, state: makeState(text) });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is created once; sheet changes swap its state below.
  }, []);

  // A different sheet (or read-only mode): start a fresh editing session.
  useEffect(() => {
    viewRef.current?.setState(makeState(text));
  }, [sheetKey, readOnly]);

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
