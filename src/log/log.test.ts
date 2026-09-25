import { describe, expect, it } from 'vitest';
import { emptyLog, mergeLogs, monthGrid, parseLog, recordSprint, recordWords, serializeLog, shade, sheetNames, totals } from './log';

const ECHO = { id: 'a1', title: 'Echo' };
const LIGHTHOUSE = { id: 'b2', title: 'The Lighthouse' };

const MORNING = new Date(2026, 8, 25, 8, 30);
const EVENING = new Date(2026, 8, 25, 21, 10);
const NEXT_DAY = new Date(2026, 8, 26, 9, 0);

describe('recording a day', () => {
  it('counts words added and cut separately, so revising isn’t a bad day', () => {
    let log = recordWords(emptyLog(), MORNING, ECHO, 600);
    log = recordWords(log, EVENING, ECHO, -200);
    expect(log.days['2026-09-25']).toEqual({ added: 600, cut: 200, sheets: { a1: 'Echo' }, sprints: 0 });
  });

  it('remembers each sheet once, by its latest name, and keeps days apart', () => {
    let log = recordWords(emptyLog(), MORNING, { id: 'a1', title: 'Untitled 2026-09-25 0830' }, 10);
    log = recordWords(log, MORNING, { id: 'a1', title: 'Ec' }, 1);
    log = recordWords(log, MORNING, ECHO, 4);
    log = recordWords(log, EVENING, LIGHTHOUSE, 7);
    log = recordWords(log, NEXT_DAY, ECHO, 3);
    expect(sheetNames(log.days['2026-09-25']!)).toEqual(['Echo', 'The Lighthouse']);
    expect(log.days['2026-09-25']!.added).toBe(22);
    expect(log.days['2026-09-26']!.added).toBe(3);
  });

  it('writes nothing for an edit that doesn’t change the count', () => {
    expect(recordWords(emptyLog(), MORNING, ECHO, 0)).toEqual(emptyLog());
  });

  it('counts sprints', () => {
    expect(recordSprint(recordSprint(emptyLog(), MORNING), EVENING).days['2026-09-25']!.sprints).toBe(2);
  });
});

describe('the log files', () => {
  it('survive a round trip', () => {
    const log = recordSprint(recordWords(emptyLog(), MORNING, ECHO, 40), MORNING);
    expect(parseLog(serializeLog(log))).toEqual(log);
  });

  it('shrug off a damaged or empty file', () => {
    expect(parseLog('not json')).toEqual(emptyLog());
    expect(parseLog(undefined)).toEqual(emptyLog());
    expect(parseLog('{"days":{"yesterday":{"added":5},"2026-09-25":{"added":"12","sheets":{"a1":"Echo","b2":3}}}}')).toEqual({
      days: { '2026-09-25': { added: 12, cut: 0, sheets: { a1: 'Echo' }, sprints: 0 } },
    });
  });

  it('add the phone and the Mac together into one day', () => {
    const phone = recordWords(emptyLog(), MORNING, ECHO, 300);
    const mac = recordSprint(recordWords(emptyLog(), EVENING, LIGHTHOUSE, 900), EVENING);
    expect(mergeLogs([phone, mac]).days['2026-09-25']).toEqual({ added: 1200, cut: 0, sheets: { a1: 'Echo', b2: 'The Lighthouse' }, sprints: 1 });
  });
});

describe('the calendar', () => {
  it('lays a month out a week to a row, Sunday first', () => {
    // September 2026 starts on a Tuesday and has 30 days.
    const weeks = monthGrid(2026, 8);
    expect(weeks[0]!.slice(0, 2)).toEqual([null, null]);
    expect(weeks[0]![2]!.getDate()).toBe(1);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('shades a day by how much you wrote', () => {
    expect([0, 40, 300, 800, 2000].map(shade)).toEqual([0, 1, 2, 3, 4]);
  });

  it('adds up the quiet totals', () => {
    let log = recordWords(emptyLog(), MORNING, ECHO, 600);
    log = recordWords(log, NEXT_DAY, ECHO, 1850);
    log = recordWords(log, new Date(2026, 8, 27), ECHO, -50);
    expect(totals(log)).toEqual({ since: '2026-09-25', words: 2450, days: 2, longest: 1850 });
    expect(totals(emptyLog())).toEqual({ since: null, words: 0, days: 0, longest: 0 });
  });
});
