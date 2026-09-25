import { describe, expect, it } from 'vitest';
import { PREVIEW_UNTIL, QUOTES, SEASONS, previewOpen, quoteOfDay, seasonNow, skipMark } from './season';

const halloween = SEASONS[0]!;
const day = (month: number, date: number, year = 2026) => new Date(year, month - 1, date, 12);
/** Days around the season's own window, whatever it has been set to. */
const firstDay = day(halloween.from[0], halloween.from[1]);
const dayBefore = new Date(firstDay.getTime() - 86_400_000);
const lastDay = day(halloween.to[0], halloween.to[1]);
const dayAfter = new Date(lastDay.getTime() + 86_400_000);
const beforePreviewEnds = new Date(PREVIEW_UNTIL.getTime() - 3_600_000);
const afterPreviewEnds = new Date(PREVIEW_UNTIL.getTime() + 3_600_000);

describe('when a season shows', () => {
  it('comes on for its window and goes away afterwards', () => {
    expect(seasonNow(dayBefore, 'auto')).toBeNull();
    expect(seasonNow(firstDay, 'auto')?.id).toBe('halloween');
    expect(seasonNow(day(10, 31), 'auto')?.id).toBe('halloween');
    expect(seasonNow(lastDay, 'auto')?.id).toBe('halloween');
    expect(seasonNow(dayAfter, 'auto')).toBeNull();
    expect(seasonNow(day(7, 4), 'auto')).toBeNull();
  });

  it('starts somewhere in the first half of October', () => {
    expect(halloween.from[0]).toBe(10);
    expect(halloween.from[1]).toBeGreaterThanOrEqual(1);
    expect(halloween.from[1]).toBeLessThanOrEqual(15);
  });

  it('shows on demand while the preview is open', () => {
    expect(previewOpen(beforePreviewEnds)).toBe(true);
    expect(seasonNow(beforePreviewEnds, 'on')?.name).toBe('Halloween');
  });

  it('keeps the surprise once the preview has closed', () => {
    expect(previewOpen(afterPreviewEnds)).toBe(false);
    expect(seasonNow(afterPreviewEnds, 'on')).toBeNull();
    // "Show me now" then behaves like "when it's time".
    expect(seasonNow(day(10, 31), 'on')?.id).toBe('halloween');
  });

  it('stays away when seasons are off, even on Halloween', () => {
    expect(seasonNow(day(10, 31), 'off')).toBeNull();
    expect(seasonNow(beforePreviewEnds, 'off')).toBeNull();
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
