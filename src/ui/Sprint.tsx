// Sprint mode's start window and the slim bar shown while a sprint runs.

import { useEffect, useState } from 'react';
import { Dialog } from './Overlays';

export type SprintState = { startedAt: number; endsAt: number | null; startWords: number };

const LENGTHS: (number | null)[] = [10, 15, 25, null];

export function SprintDialog({ onStart, onClose }: { onStart: (minutes: number | null) => void; onClose: () => void }) {
  return (
    <Dialog title="Sprint" onClose={onClose}>
      <p className="muted">Keep going forward: backspace only works within the sentence you’re typing, and earlier text fades. Press Esc or ⌥⌘S to stop any time.</p>
      <div className="sprint-lengths">
        {LENGTHS.map((m) => (
          <button key={String(m)} className={m === null ? 'quiet' : undefined} onClick={() => onStart(m)}>
            {m === null ? 'No timer' : `${m} minutes`}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button className="quiet" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type BarProps = { sprint: SprintState; words: number; onEnd: (timeUp: boolean) => void };

export function SprintBar({ sprint, words, onEnd }: BarProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (sprint.endsAt && now >= sprint.endsAt) onEnd(true);
  }, [now, sprint.endsAt, onEnd]);

  const written = Math.max(0, words - sprint.startWords);
  return (
    <div className="sprint-bar" role="status">
      <span className="dot" />
      <span>{sprint.endsAt ? `${clock(sprint.endsAt - now)} left` : `${clock(now - sprint.startedAt)}`}</span>
      <span className="muted">·</span>
      <span>
        {written.toLocaleString()} new word{written === 1 ? '' : 's'}
      </span>
      <button className="quiet small" onClick={() => onEnd(false)}>
        End sprint
      </button>
    </div>
  );
}
