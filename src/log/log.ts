// The writing log: a quiet record of the days you wrote. It counts the words
// you add as you type — not your net total, so a day of revising never looks
// like a bad day — plus what you cut, the sheets you touched and your sprints.
// No streaks, no goals, no reminders.
//
// Each device keeps its own small file in Dropbox ("_quill/log/<device>.json"),
// so two devices can never fight over one file. The calendar adds them up.

export const LOG_FOLDER = '/_quill/log';

export type Day = {
  /** Words added by your own typing. */
  added: number;
  /** Words taken out. */
  cut: number;
  /** The sheets you wrote in: each sheet's lasting id, and its latest name. */
  sheets: Record<string, string>;
  sprints: number;
};

export type Log = { days: Record<string, Day> };

export const emptyLog = (): Log => ({ days: {} });

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-25", in your own time zone. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const blankDay = (): Day => ({ added: 0, cut: 0, sheets: {}, sprints: 0 });

/**
 * Notes one edit: `change` words more (or fewer) in a sheet. The sheet is kept
 * by its lasting id, so a name that changes as you type it shows up once, as
 * it ended up. Nothing is recorded for no change.
 */
export function recordWords(log: Log, date: Date, sheet: { id: string; title: string }, change: number): Log {
  if (change === 0) return log;
  const key = dayKey(date);
  const day = { ...(log.days[key] ?? blankDay()) };
  if (change > 0) day.added += change;
  else day.cut += -change;
  day.sheets = { ...day.sheets, [sheet.id]: sheet.title };
  return { days: { ...log.days, [key]: day } };
}

/** The names of the sheets written in on a day. */
export const sheetNames = (day: Day): string[] => [...new Set(Object.values(day.sheets))];

export function recordSprint(log: Log, date: Date): Log {
  const key = dayKey(date);
  const day = { ...(log.days[key] ?? blankDay()) };
  day.sprints += 1;
  return { days: { ...log.days, [key]: day } };
}

/** Reads a device's log file, forgiving anything it doesn't recognise. */
export function parseLog(text: string | undefined): Log {
  if (!text) return emptyLog();
  try {
    const raw = JSON.parse(text) as { days?: Record<string, Partial<Day>> };
    const days: Record<string, Day> = {};
    for (const [key, d] of Object.entries(raw.days ?? {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !d) continue;
      days[key] = {
        added: Math.max(0, Number(d.added) || 0),
        cut: Math.max(0, Number(d.cut) || 0),
        sheets: Object.fromEntries(Object.entries(d.sheets && typeof d.sheets === 'object' && !Array.isArray(d.sheets) ? d.sheets : {}).filter((e): e is [string, string] => typeof e[1] === 'string')),
        sprints: Math.max(0, Number(d.sprints) || 0),
      };
    }
    return { days };
  } catch {
    return emptyLog();
  }
}

export function serializeLog(log: Log): string {
  const days = Object.fromEntries(Object.entries(log.days).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({ about: 'Quill’s writing log for one device. Quill adds these together.', days }, null, 1) + '\n';
}

/** Every device's log as one. */
export function mergeLogs(logs: Log[]): Log {
  const days: Record<string, Day> = {};
  for (const log of logs) {
    for (const [key, d] of Object.entries(log.days)) {
      const into = days[key] ?? blankDay();
      days[key] = {
        added: into.added + d.added,
        cut: into.cut + d.cut,
        sheets: { ...into.sheets, ...d.sheets },
        sprints: into.sprints + d.sprints,
      };
    }
  }
  return { days };
}

/**
 * The days of a month laid out as a calendar, a week to a row, Sunday first.
 * Days from the neighbouring months are null, so the grid lines up.
 */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** How dark a day's square is: 0 for nothing written, up to 4 for your biggest days. */
export function shade(added: number): 0 | 1 | 2 | 3 | 4 {
  if (added <= 0) return 0;
  if (added < 150) return 1;
  if (added < 500) return 2;
  if (added < 1200) return 3;
  return 4;
}

export type Totals = { since: string | null; words: number; days: number; longest: number };

/** The quiet totals at the top: words since the first day, days written, longest day. */
export function totals(log: Log): Totals {
  const written = Object.entries(log.days).filter(([, d]) => d.added > 0);
  if (written.length === 0) return { since: null, words: 0, days: 0, longest: 0 };
  return {
    since: written.map(([k]) => k).sort()[0]!,
    words: written.reduce((sum, [, d]) => sum + d.added, 0),
    days: written.length,
    longest: Math.max(...written.map(([, d]) => d.added)),
  };
}
