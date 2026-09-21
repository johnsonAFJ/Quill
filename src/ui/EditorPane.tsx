import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { EditorView } from '@codemirror/view';
import { Editor } from '../editor/Editor';
import { wordCount } from '../text/markdown';
import { FormatBar } from './FormatBar';
import { Icon } from './icons';
import { MenuButton, type MenuItem } from './Overlays';

type Props = {
  sheetKey: string | null;
  text: string;
  readOnly: boolean;
  unsynced: boolean;
  touch: boolean;
  focusMode: boolean;
  showWords: boolean;
  menu: MenuItem[];
  banner?: ReactNode;
  onChange: (text: string) => void;
  onBack?: () => void;
  onToggleFocus?: () => void;
  onToggleWords: () => void;
};

export function EditorPane(props: Props) {
  const { sheetKey, text, readOnly, unsynced, touch, focusMode, showWords, menu, banner, onChange, onBack, onToggleFocus, onToggleWords } = props;
  const viewRef = useRef<EditorView | null>(null);
  const [typing, setTyping] = useState(false);
  const words = useMemo(() => (showWords ? wordCount(text) : 0), [showWords, text]);

  if (!sheetKey) {
    return (
      <main className="pane editor-pane empty">
        <p className="hint">Choose a sheet, or make a new one with +.</p>
      </main>
    );
  }

  return (
    <main className={`pane editor-pane${focusMode ? ' focus' : ''}`}>
      <header className="editor-header">
        {onBack ? (
          <button className="icon-button back" aria-label="Back to sheets" onClick={onBack}>
            <Icon name="back" /> <span>Sheets</span>
          </button>
        ) : onToggleFocus ? (
          <button className="icon-button" aria-label={focusMode ? 'Show sidebars' : 'Hide sidebars'} title="Focus (⌘⇧F)" onClick={onToggleFocus}>
            <Icon name={focusMode ? 'sidebar' : 'expand'} />
          </button>
        ) : (
          <span />
        )}
        <div className="editor-header-end">
          {unsynced && <span className="dot" title="Saved on this device, not in Dropbox yet" />}
          {readOnly && <span className="readonly-label">In Trash</span>}
          <MenuButton items={menu} label="Sheet actions" />
        </div>
      </header>
      {banner}
      {!touch && !readOnly && !focusMode && <FormatBar viewRef={viewRef} floating={false} />}
      <Editor sheetKey={sheetKey} text={text} readOnly={readOnly} onChange={onChange} onFocusChange={setTyping} viewRef={viewRef} />
      {touch && typing && !readOnly && <FormatBar viewRef={viewRef} floating />}
      {showWords && (
        <button className="word-count" onClick={onToggleWords} title="Hide word count">
          {words.toLocaleString()} word{words === 1 ? '' : 's'}
        </button>
      )}
    </main>
  );
}
