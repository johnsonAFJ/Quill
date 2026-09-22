import { useMemo, useRef, useState, type ReactNode } from 'react';
import { prefs } from '../app/device';
import type { EditorView } from '@codemirror/view';
import { Editor } from '../editor/Editor';
import { wordCount } from '../text/markdown';
import { FormatBar } from './FormatBar';
import { SprintBar, type SprintState } from './Sprint';
import { Icon } from './icons';
import { MenuButton, type MenuItem } from './Overlays';

type Props = {
  sheetKey: string | null;
  /** The sheet's lasting id, for remembering folded sections. */
  sheetId: string | null;
  text: string;
  readOnly: boolean;
  unsynced: boolean;
  touch: boolean;
  focusMode: boolean;
  showWords: boolean;
  typewriterMode: boolean;
  sprint: SprintState | null;
  onEndSprint: (timeUp: boolean) => void;
  menu: MenuItem[];
  banner?: ReactNode;
  notesCount: number;
  /** A note pinned to show below the writing. */
  pinned?: { title: string; body: string };
  onUnpin: () => void;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onChange: (text: string) => void;
  onBack?: () => void;
  onToggleFocus?: () => void;
  onToggleWords: () => void;
};

export function EditorPane(props: Props) {
  const { sheetKey, sheetId, text, readOnly, unsynced, touch, focusMode, showWords, typewriterMode, sprint, onEndSprint, menu, banner, notesCount, pinned, onUnpin, notesOpen, onToggleNotes, onChange, onBack, onToggleFocus, onToggleWords } = props;
  const viewRef = useRef<EditorView | null>(null);
  const [typing, setTyping] = useState(false);
  const [selected, setSelected] = useState('');
  // Folded to just its heading? Remembered on this device; folded to start on iPhone.
  const [pinFolded, setPinFolded] = useState<boolean>(() => prefs.get('pinFolded', touch));
  const words = useMemo(() => (showWords || sprint ? wordCount(text) : 0), [showWords, sprint, text]);
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
          {notesCount >= 0 && (
            <button className={`icon-button${notesOpen ? ' on' : ''}`} aria-label={`Notes (${notesCount})`} aria-pressed={notesOpen} title="Notes" onClick={onToggleNotes}>
              <Icon name="paperclip" />
              {notesCount > 0 && <span className="notes-count">{notesCount}</span>}
            </button>
          )}
          <MenuButton items={menu} label="Sheet actions" />
        </div>
      </header>
      {banner}
      {sprint && <SprintBar sprint={sprint} words={words} onEnd={onEndSprint} />}
      {!touch && !readOnly && !focusMode && <FormatBar viewRef={viewRef} floating={false} />}
      <Editor sheetKey={sheetKey} foldKey={sheetId ?? sheetKey} text={text} readOnly={readOnly} typewriterMode={typewriterMode} sprintMode={Boolean(sprint) && !readOnly} onChange={onChange} onFocusChange={setTyping} onSelectionChange={setSelected} viewRef={viewRef} />
      {pinned && (
        <aside className={`pinned-note${pinFolded ? ' folded' : ''}`} aria-label="Pinned note">
          <header>
            <button
              className="icon-button fold"
              aria-label={pinFolded ? 'Show pinned note' : 'Fold pinned note'}
              aria-expanded={!pinFolded}
              onClick={() => {
                setPinFolded(!pinFolded);
                prefs.set('pinFolded', !pinFolded);
              }}
            >
              <Icon name={pinFolded ? 'chevronRight' : 'chevronDown'} size={14} />
            </button>
            <Icon name="pin" size={14} />
            <strong>{pinned.title || 'Pinned note'}</strong>
            <button className="icon-button" aria-label="Unpin" title="Unpin" onClick={onUnpin}>
              <Icon name="close" size={14} />
            </button>
          </header>
          {!pinFolded && <div className="pinned-body">{pinned.body || <span className="muted">This note is empty.</span>}</div>}
        </aside>
      )}
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
