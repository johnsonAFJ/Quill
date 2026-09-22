import { useEffect, useRef } from 'react';
import type { SearchHit } from '../library/search';
import { Icon } from './icons';

type Props = {
  query: string;
  hits: SearchHit[];
  onQuery: (query: string) => void;
  onOpen: (hit: SearchHit) => void;
  onBack?: () => void;
  /** Esc: back to where you were. */
  onClose: () => void;
};

const LABEL = { sheet: '', sheetNotes: 'In notes', groupNotes: 'Group notes' } as const;

export function SearchPane({ query, hits, onQuery, onOpen, onBack, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  return (
    <section className="pane sheet-pane" aria-label="Search">
      <header className="pane-header">
        <div className="pane-tools">
          {onBack ? (
            <button className="icon-button back" aria-label="Library" onClick={onBack}>
              <Icon name="back" /> <span>Library</span>
            </button>
          ) : (
            <span />
          )}
        </div>
        <h1>Search</h1>
        <input
          ref={input}
          className="search-input"
          type="search"
          placeholder="Sheets and notes"
          value={query}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        {query.trim() && (
          <div className="sort-label">
            {hits.length} result{hits.length === 1 ? '' : 's'}
          </div>
        )}
      </header>
      <div className="pane-body sheet-cards">
        {query.trim() && hits.length === 0 && <p className="hint">Nothing found. Every word has to appear in the same sheet or notes.</p>}
        {hits.map((hit, i) => (
          <div key={`${hit.kind}:${hit.key}:${i}`} className="sheet-card">
            <button className="card-main" onClick={() => onOpen(hit)}>
              <div className="card-title">{hit.title || 'Untitled'}</div>
              <div className="card-where">
                {hit.where}
                {LABEL[hit.kind] && <span className="badge quiet-badge">{LABEL[hit.kind]}</span>}
              </div>
              <div className="card-preview">
                {hit.snippet.before}
                <mark>{hit.snippet.match}</mark>
                {hit.snippet.after}
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
