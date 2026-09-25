import { describe, expect, it } from 'vitest';
import { QUOTES, SEASONS, quoteOfDay, seasonNow, skipMark } from './season';

const halloween = SEASONS[0]!;
const day = (month: number, date: number, year = 2026) => new Date(year, month - 1, date, 12);

describe('when a season shows', () => {
  it('comes on for its window and goes away afterwards', () => {
    expect(seasonNow(day(10, 14), 'auto')).toBeNull();
    expect(seasonNow(day(10, 15), 'auto')?.id).toBe('halloween');
    expect(seasonNow(day(10, 31), 'auto')?.id).toBe('halloween');
    expect(seasonNow(day(11, 1), 'auto')?.id).toBe('halloween');
    expect(seasonNow(day(11, 2), 'auto')).toBeNull();
    expect(seasonNow(day(7, 4), 'auto')).toBeNull();
  });

  it('shows on demand any day of the year, for a look', () => {
    expect(seasonNow(day(3, 9), 'on')?.name).toBe('Halloween');
  });

  it('stays away when seasons are off, even on Halloween', () => {
    expect(seasonNow(day(10, 31), 'off')).toBeNull();
  });

  it('skips the year you said no to, and comes back the next one', () => {
    const skipped = [skipMark(halloween, day(10, 31))];
    expect(skipped).toEqual(['halloween-2026']);
    expect(seasonNow(day(10, 31), 'auto', skipped)).toBeNull();
    expect(seasonNow(day(10, 31, 2027), 'auto', skipped)?.id).toBe('halloween');
  });
});

describe('the line of the day', () => {
  it('stays the same all day and changes tomorrow', () => {
    const morning = quoteOfDay(halloween, new Date(2026, 9, 31, 7));
    const night = quoteOfDay(halloween, new Date(2026, 9, 31, 23));
    const tomorrow = quoteOfDay(halloween, new Date(2026, 10, 1, 7));
    expect(morning).toEqual(night);
    expect(tomorrow).not.toEqual(morning);
  });

  it('gets through the whole list before repeating', () => {
    const list = QUOTES.halloween;
    const seen = new Set(Array.from({ length: list.length }, (_, i) => quoteOfDay(halloween, new Date(2026, 9, 1 + i, 9))?.line));
    expect(seen.size).toBe(list.length);
  });

  it('credits every line to its book', () => {
    expect(QUOTES.halloween.every((q) => q.line.length > 0 && q.from.includes(','))).toBe(true);
  });
});
