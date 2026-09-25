import { describe, expect, it } from 'vitest';
import { SEASONS, seasonNow, skipMark } from './season';

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
