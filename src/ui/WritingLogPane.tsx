// The writing log in the Library: a month at a time, each day a square that's
// darker the more you wrote. Tap a day to see what's behind it.

import { useState } from 'react';
import { dayKey, monthGrid, shade, sheetNames, totals, type Log } from '../log/log';
import { Icon } from './icons';

type Props = { log: Log; onBack?: () => void };

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const niceDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

export function WritingLogPane({ log, onBack }: Props) {
  const today = new Date();
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [chosen, setChosen] = useState<string>(dayKey(today));
  const sum = totals(log);
  const day = log.days[chosen];
  const isThisMonth = shown.year === today.getFullYear() && shown.month === today.getMonth();

  const step = (by: number) => {
    const d = new Date(shown.year, shown.month + by, 1);
    setShown({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <section className="pane sheet-pane log-pane" aria-label="Writing log">
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
        <h1>Writing log</h1>
        <div className="sort-label">
          {sum.since
            ? `${sum.words.toLocaleString()} words since ${niceDate(sum.since).replace(/^\w+, /, '')} · ${sum.days} day${sum.days === 1 ? '' : 's'} · longest ${sum.longest.toLocaleString()}`
            : 'Starts counting the next time you write.'}
        </div>
      </header>
      <div className="pane-body">
        <div className="log-month">
          <button className="icon-button" aria-label="Previous month" onClick={() => step(-1)}>
            <Icon name="back" size={16} />
          </button>
          <strong>{new Date(shown.year, shown.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
          <button className="icon-button" aria-label="Next month" disabled={isThisMonth} onClick={() => step(1)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="log-grid" role="grid">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="log-weekday" aria-hidden="true">
              {w}
            </span>
          ))}
          {monthGrid(shown.year, shown.month)
            .flat()
            .map((date, i) => {
              if (!date) return <span key={i} className="log-day empty" />;
              const key = dayKey(date);
              const written = log.days[key]?.added ?? 0;
              const future = date > today && key !== dayKey(today);
              return (
                <button
                  key={i}
                  className={`log-day level-${shade(written)}${key === chosen ? ' on' : ''}${key === dayKey(today) ? ' today' : ''}`}
                  disabled={future}
                  aria-label={`${niceDate(key)}: ${written.toLocaleString()} words`}
                  onClick={() => setChosen(key)}
                >
                  {date.getDate()}
                </button>
              );
            })}
        </div>
        <div className="log-detail">
          <h3>{niceDate(chosen)}</h3>
          {day && (day.added > 0 || day.cut > 0 || day.sprints > 0) ? (
            <>
              <p>
                <strong>{day.added.toLocaleString()}</strong> word{day.added === 1 ? '' : 's'} written
                {day.cut > 0 && <span className="muted"> · {day.cut.toLocaleString()} cut</span>}
                {day.sprints > 0 && (
                  <span className="muted">
                    {' '}
                    · {day.sprints} sprint{day.sprints === 1 ? '' : 's'}
                  </span>
                )}
              </p>
              {sheetNames(day).length > 0 && <p className="muted">{sheetNames(day).join(' · ')}</p>}
            </>
          ) : (
            <p className="muted">Nothing written this day.</p>
          )}
        </div>
        <p className="hint">Words you add as you type, on every device. Cutting and revising never count against you.</p>
      </div>
    </section>
  );
}
