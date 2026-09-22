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
  notesCount: number;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onChange: (text: string) => void;
  onBack?: () => void;
  onToggleFocus?: () => void;
  onToggleWords: () => void;
};

export function EditorPane(props: Props) {
  const { sheetKey, text, readOnly, unsynced, touch, focusMode, showWords, menu, banner, notesCount, notesOpen, onToggleNotes, onChange, onBack, onToggleFocus, onToggleWords } = props;
  const viewRef = useRef<EditorView | null>(null);
  const [typing, setTyping] = useState(false);
  const [selected, setSelected] = useState('');
  const words = useMemo(() => (showWords ? wordCount(text) : 0), [showWords, text]);
  const selectedWords = useMemo(() => (showWords && selected ? wordCount(selected) : 0), [showWords, selected]);

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
          <button className="icon-button" aria-label={focusMode ? 'Show sidebars' : 'Hide a sidebar'} title="Show or hide sidebars (⌘⇧F: just the text)" onClick={onToggleFocus}>
            <Icon name="sidebar" />
          </button>
        ) : (
          <span />
        )}
        <div className="editor-header-end">
          {unsynced && <span className="dot" title="Saved on this device, not in Dropbox yet" />}
          {readOnly && <span className="readonly-label">In Trash</span>}
          <button className={`icon-button${notesOpen ? ' on' : ''}`} aria-label={`Notes (${notesCount})`} aria-pressed={notesOpen} title="Notes" onClick={onToggleNotes}>
            <Icon name="paperclip" />
            {notesCount > 0 && <span className="notes-count">{notesCount}</span>}
          </button>
          <MenuButton items={menu} label="Sheet actions" />
        </div>
      </header>
      {banner}
      {!touch && !readOnly && !focusMode && <FormatBar viewRef={viewRef} floating={false} />}
      <Editor sheetKey={sheetKey} text={text} readOnly={readOnly} onChange={onChange} onFocusChange={setTyping} onSelectionChange={setSelected} viewRef={viewRef} />
      {touch && typing && !readOnly && <FormatBar viewRef={viewRef} floating />}
      {showWords && (
        <button className="word-count" onClick={onToggleWords} title="Hide word count">
          {selectedWords > 0 ? `${selectedWords.toLocaleString()} of ` : ''}
          {words.toLocaleString()} word{words === 1 ? '' : 's'}
        </button>
      )}
    </main>
  );
}
