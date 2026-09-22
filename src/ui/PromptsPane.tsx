// "Prompts" in the Library: how many are left, and one at a time on request.

import { useState } from 'react';
import { promptParts } from '../prompts/prompts';
import { Icon } from './icons';

type Props = {
  unused: number;
  used: number;
  /** Where a sheet started from a prompt goes, e.g. "Prompted" or "Inbox". */
  destination: string;
  /** Hands out a prompt and marks it used. null: not ready yet (no word from Dropbox); "": none left. */
  onTake: () => string | null;
  onStart: (prompt: string) => void;
  onOpenList: () => void;
  onBack?: () => void;
};

export function PromptsPane({ unused, used, destination, onTake, onStart, onOpenList, onBack }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const take = () => {
    const next = onTake();
    if (next === null) setMessage('Quill needs to reach Dropbox once before it can make your prompt list. Try again in a moment.');
    else if (next === '') setMessage('You’ve used every prompt on your list. Add more to it, or ask for another batch.');
    else {
      setPrompt(next);
      setMessage(null);
    }
  };

  return (
    <section className="pane sheet-pane prompts-pane" aria-label="Prompts">
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
        <h1>Prompts</h1>
        <div className="sort-label">
          {unused.toLocaleString()} left · {used.toLocaleString()} used
        </div>
      </header>
      <div className="pane-body">
        {prompt && (
          <div className="prompt-card">
            <PromptText prompt={prompt} />
            <div className="prompt-actions">
              <button onClick={() => onStart(prompt)}>Start a sheet in {destination}</button>
              <button className="quiet" onClick={take}>
                Another prompt
              </button>
            </div>
          </div>
        )}
        {!prompt && (
          <div className="prompt-card empty">
            <button onClick={take}>
              <Icon name="sparkle" size={18} /> Give me a prompt
            </button>
          </div>
        )}
        {message && <p className="notice">{message}</p>}
        <p className="hint">
          Every prompt Quill gives you is ticked off, so you’ll never see it again on any device. Starting a sheet puts the prompt at the top as a comment, so it isn’t counted as words.
        </p>
        <button className="quiet small list-button" onClick={onOpenList}>
          See and edit the whole list
        </button>
      </div>
    </section>
  );
}

function PromptText({ prompt }: { prompt: string }) {
  const { title, body, details } = promptParts(prompt);
  return (
    <>
      {title && <h2 className="prompt-title">{title}</h2>}
      <p>{body}</p>
      {details.length > 0 && (
        <dl className="prompt-details">
          {details.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
