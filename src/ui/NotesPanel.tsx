// Notes beside a sheet or group: one card per "## " note in its notes file.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { addNote, parseNotes, removeNote, updateNote } from '../notes/notes';
import { Icon } from './icons';

type Props = {
  /** "The Lighthouse" or "Essays", shown under the panel title. */
  label: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
  onClose: () => void;
};

export function NotesPanel({ label, text, readOnly, onChange, onClose }: Props) {
  const notes = parseNotes(text);
  const [focusLast, setFocusLast] = useState(false);

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
                setFocusLast(true);
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
            autoFocus={focusLast && i === notes.length - 1}
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
  autoFocus: boolean;
  onEdit: (title: string, body: string) => void;
  onDelete: () => void;
};

function NoteCard({ title, body, readOnly, autoFocus, onEdit, onDelete }: CardProps) {
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
    if (autoFocus) titleRef.current?.select();
  }, [autoFocus]);

  // Grow the text box to fit what's in it.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.body]);

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
    <div className="note-card">
      <div className="note-title-row">
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
        {!readOnly && (
          <button className="icon-button" aria-label="Delete note" onClick={onDelete}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
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
    </div>
  );
}
