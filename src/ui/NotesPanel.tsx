// Notes beside a sheet or group: one card per "## " note in its notes file.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefs } from '../app/device';
import { addNote, parseNotes, removeNote, togglePin, updateNote } from '../notes/notes';
import { wordCount } from '../text/markdown';
import { Icon } from './icons';

type Props = {
  /** The notes file, used to remember which notes are folded on this device. */
  path: string;
  /** "The Lighthouse" or "Essays", shown under the panel title. */
  label: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  onClose: () => void;
};

/** Which notes are folded, remembered per device by notes file and heading. */
function useFolded(path: string) {
  const [folded, setFolded] = useState<string[]>(() => prefs.get('foldedNotes', []));
  const id = (title: string, index: number) => `${path.toLowerCase()}\n${title || `#${index}`}`;
  return {
    isFolded: (title: string, index: number) => folded.includes(id(title, index)),
    toggle: (title: string, index: number) => {
      const key = id(title, index);
      const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
      setFolded(next);
      prefs.set('foldedNotes', next);
    },
  };
}

export function NotesPanel({ path, label, text, readOnly, onChange, onClose }: Props) {
  const notes = parseNotes(text);
  // The note just added, whose title gets focus once.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const { isFolded, toggle } = useFolded(path);

  return (
    <aside className="pane notes-pane" aria-label="Notes">
      <header className="pane-header">
        <div className="pane-tools">
          <span />
          {!readOnly && (
            <button
              className="icon-button"
              aria-label="Add note"
              onClick={() => {
                onChange(addNote(text));
                setFocusIndex(notes.length);
              }}
            >
              <Icon name="plus" />
            </button>
          )}
          <button className="icon-button done" onClick={onClose}>
            Done
          </button>
        </div>
        <h1>Notes</h1>
        <div className="sort-label">{label}</div>
      </header>
      <div className="pane-body notes-body">
        {notes.length === 0 && (
          <p className="hint">
            No notes yet.{readOnly ? '' : ' Tap + to add one, for ideas, research or anything you don’t want in the text itself.'}
          </p>
        )}
        {notes.map((note, i) => (
          <NoteCard
            // A card is tied to its position; the count keys it afresh when notes are added or removed.
            key={`${notes.length}-${i}`}
            title={note.title}
            body={note.body}
            readOnly={readOnly}
            folded={isFolded(note.title, i)}
            pinned={note.pinned}
            canPin={!readOnly && note.raw.startsWith('## ')}
            onTogglePin={() => onChange(togglePin(text, i))}
            onToggleFold={() => toggle(note.title, i)}
            autoFocus={focusIndex === i}
            onAutoFocused={() => setFocusIndex(null)}
            onEdit={(title, body) => onChange(updateNote(text, i, title, body))}
            onDelete={() => {
              if (confirm(`Delete the note “${note.title || 'Untitled'}”?`)) onChange(removeNote(text, i));
            }}
          />
        ))}
      </div>
    </aside>
  );
}

type CardProps = {
  title: string;
  body: string;
  readOnly: boolean;
  folded: boolean;
  onToggleFold: () => void;
  pinned: boolean;
  canPin: boolean;
  onTogglePin: () => void;
  autoFocus: boolean;
  onAutoFocused: () => void;
  onEdit: (title: string, body: string) => void;
  onDelete: () => void;
};

function NoteCard({ title, body, readOnly, folded, onToggleFold, pinned, canPin, onTogglePin, autoFocus, onAutoFocused, onEdit, onDelete }: CardProps) {
  // What you're typing, untrimmed. The file gets a tidied version.
  const [draft, setDraft] = useState({ title, body });
  const editing = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // A newer version arrived from another device while you weren't typing here.
  useEffect(() => {
    if (!editing.current) setDraft({ title, body });
  }, [title, body]);

  useEffect(() => {
    if (!autoFocus) return;
    titleRef.current?.select();
    onAutoFocused();
  }, [autoFocus, onAutoFocused]);

  // Grow the text box to fit what's in it.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.body, folded]);

  const change = (next: { title: string; body: string }) => {
    setDraft(next);
    onEdit(next.title, next.body);
  };

  const focus = {
    onFocus: () => (editing.current = true),
    onBlur: () => {
      editing.current = false;
      setDraft({ title, body });
    },
  };

  return (
    <div className={`note-card${folded ? ' folded' : ''}${pinned ? ' pinned' : ''}`}>
      <div className="note-title-row">
        <button className="icon-button fold" aria-label={folded ? 'Show note' : 'Fold note'} aria-expanded={!folded} onClick={onToggleFold}>
          <Icon name={folded ? 'chevronRight' : 'chevronDown'} size={14} />
        </button>
        <input
          ref={titleRef}
          className="note-title"
          value={draft.title}
          placeholder="Untitled note"
          readOnly={readOnly}
          onChange={(e) => change({ ...draft, title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), bodyRef.current?.focus())}
          {...focus}
        />
        {folded && draft.body && <span className="note-folded-count">{wordCount(draft.body).toLocaleString()} words</span>}
        {canPin && (
          <button className={`icon-button${pinned ? ' on' : ''}`} aria-label={pinned ? 'Unpin from the writing area' : 'Pin below the writing area'} title={pinned ? 'Unpin' : 'Pin below the writing'} aria-pressed={pinned} onClick={onTogglePin}>
            <Icon name="pin" size={16} />
          </button>
        )}
        {!readOnly && (
          <button className="icon-button" aria-label="Delete note" onClick={onDelete}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
      {!folded && (
        <textarea
          ref={bodyRef}
          className="note-body"
          value={draft.body}
          placeholder="Write a note…"
          rows={2}
          readOnly={readOnly}
          onChange={(e) => change({ ...draft, body: e.target.value })}
          {...focus}
        />
      )}
    </div>
  );
}
