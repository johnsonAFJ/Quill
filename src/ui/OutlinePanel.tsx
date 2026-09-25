// The outline of the open sheet: its headings, as a skeleton you can build
// before you write and rearrange afterwards. There's no separate outline
// document — every line here is a heading in the sheet, so they can't drift.

import { useEffect, useRef, useState } from 'react';
import { changeLevel, insertSection, moveSection, outlineOf, removeSection, renameHeading } from '../outline/outline';
import { Icon } from './icons';

type Props = {
  text: string;
  readOnly: boolean;
  /** Which heading the cursor sits in, so the outline can show where you are. */
  cursor: number;
  onChange: (text: string) => void;
  /** Where a removed section goes, so it can be put back later (Cuts). */
  onSetAside: (removed: string) => void;
  /** Puts the cursor in the sheet at this spot and brings it into view. */
  onJump: (at: number) => void;
  onClose: () => void;
};

export function OutlinePanel({ text, readOnly, cursor, onChange, onSetAside, onJump, onClose }: Props) {
  const outline = outlineOf(text);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [chosen, setChosen] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing === null) return;
    const field = input.current;
    if (field && document.activeElement !== field) {
      field.focus();
      field.select();
    }
  });

  const here = outline.findIndex((h) => cursor >= h.from && cursor < h.to);
  const selected = editing ?? (here >= 0 ? here : Math.min(chosen, outline.length - 1));

  const startRename = (index: number) => {
    setDraft(outline[index]?.title ?? '');
    setEditing(index);
  };

  /** The text with the heading being edited renamed, so one keystroke can rename and do more. */
  const renamed = () => (editing === null ? text : renameHeading(text, editing, draft));

  const commit = () => {
    if (editing === null) return;
    const next = renamed();
    setEditing(null);
    if (next !== text) onChange(next);
  };

  /** Adds a section after `after` (the end when null) and opens it for naming. */
  const add = (after: number | null, from = text) => {
    const { text: next, at } = insertSection(from, after);
    const index = outlineOf(next).findIndex((h) => h.from === at);
    setChosen(index);
    setDraft('');
    setEditing(index);
    onChange(next);
  };

  /** Enter: name this one and start the next, the way an outline is usually typed. */
  const nameAndContinue = () => {
    if (editing === null) return;
    add(editing, renamed());
  };

  const move = (index: number, direction: 'up' | 'down') => {
    const next = moveSection(text, index, direction);
    if (next === text) return;
    const moved = outlineOf(next).findIndex((h) => h.title === outline[index]!.title && h.level === outline[index]!.level);
    setChosen(moved < 0 ? index : moved);
    onChange(next);
  };

  /** Removing a section keeps it: anything written in it goes to Cuts. */
  const remove = (index: number) => {
    const heading = outline[index];
    if (!heading) return;
    const { text: next, removed } = removeSection(text, index);
    const words = removed.replace(/^#+.*$/m, '').trim();
    if (words && !confirm(`Take out “${heading.title || 'this section'}” and its writing? It goes to Cuts, so you can put it back.`)) return;
    if (words) onSetAside(removed);
    setEditing(null);
    onChange(next);
  };

  const nudge = (index: number, delta: 1 | -1, from = text) => {
    const next = changeLevel(from, index, delta);
    if (next !== text) onChange(next);
  };

  return (
    <aside className="pane outline-pane" aria-label="Outline">
      <header className="pane-header">
        <div className="pane-tools">
          <span className="panel-title">Outline</span>
          <button className="icon-button" aria-label="Close the outline" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>
      <div className="pane-body">
        {outline.length === 0 && (
          <p className="hint">
            No sections yet. {readOnly ? 'Headings in the sheet show up here.' : 'Add one below to start a skeleton, then write into it.'}
          </p>
        )}
        <ul className="outline-list">
          {outline.map((h, i) => (
            <li key={i} className={i === selected ? 'on' : undefined} style={{ paddingLeft: `${0.25 + h.depth * 0.9}rem` }}>
              <span className="outline-number">{h.number}.</span>
              {editing === i ? (
                <input
                  ref={input}
                  className="outline-input"
                  value={draft}
                  placeholder="Section name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (readOnly) commit();
                      else nameAndContinue();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      commit();
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      nudge(i, e.shiftKey ? -1 : 1, renamed());
                    }
                  }}
                />
              ) : (
                <button
                  className="outline-title"
                  onClick={() => {
                    setChosen(i);
                    onJump(h.from);
                  }}
                  onDoubleClick={() => !readOnly && startRename(i)}
                  title="Click to go there, double-click to rename"
                >
                  {h.title || <span className="muted">Untitled section</span>}
                </button>
              )}
              {!readOnly && editing !== i && (
                <span className="outline-actions">
                  <button className="icon-button" aria-label="Move up" title="Move up (its writing comes too)" onClick={() => move(i, 'up')}>
                    <Icon name="chevronUp" size={14} />
                  </button>
                  <button className="icon-button" aria-label="Move down" title="Move down (its writing comes too)" onClick={() => move(i, 'down')}>
                    <Icon name="chevronDown" size={14} />
                  </button>
                  <button className="icon-button" aria-label="Indent" title="Indent under the section above" onClick={() => nudge(i, 1)}>
                    <Icon name="indent" size={14} />
                  </button>
                  <button className="icon-button" aria-label="Outdent" title="Move out a level" onClick={() => nudge(i, -1)}>
                    <Icon name="outdent" size={14} />
                  </button>
                  <button className="icon-button" aria-label="Add a section below" title="Add a section below" onClick={() => add(i)}>
                    <Icon name="plus" size={14} />
                  </button>
                  <button className="icon-button" aria-label="Take this section out" title="Take it out (its writing goes to Cuts)" onClick={() => remove(i)}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <button className="quiet small outline-add" onClick={() => add(outline.length ? outline.length - 1 : null)}>
            <Icon name="plus" size={14} /> Add a section
          </button>
        )}
      </div>
      <footer className="outline-foot muted">Sections are the sheet’s own headings. Moving one takes its writing with it.</footer>
    </aside>
  );
}
