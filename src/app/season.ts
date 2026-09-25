// Seasonal looks: for a few weeks a year Quill changes the colours of the
// frame around your writing (the Library, the sheet list, the accents) and
// nothing else. The writing area never changes, and nothing moves or blinks.
//
// You can turn a season on any time to see it, switch seasons off for good,
// or skip just this year's.

export type SeasonId = 'halloween';

export type Season = {
  id: SeasonId;
  name: string;
  /** Inclusive window, as [month, day] with January = 1. */
  from: [number, number];
  to: [number, number];
  /** How the window reads in Settings. */
  when: string;
};

export const SEASONS: Season[] = [{ id: 'halloween', name: 'Halloween', from: [10, 15], to: [11, 1], when: 'October 15 to November 1' }];

/** Settings: follow the calendar, keep one on to look at it, or no seasons at all. */
export type SeasonChoice = 'auto' | 'on' | 'off';

const dayNumber = (month: number, day: number) => month * 100 + day;

/** Whether `date` falls inside the season's window (which may cross new year). */
export function inWindow(season: Season, date: Date): boolean {
  const today = dayNumber(date.getMonth() + 1, date.getDate());
  const from = dayNumber(...season.from);
  const to = dayNumber(...season.to);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/** The mark that remembers a season was skipped, e.g. "halloween-2026". */
export function skipMark(season: Season, date: Date): string {
  // A window crossing new year belongs to the year it started in.
  const crossesYear = dayNumber(...season.from) > dayNumber(...season.to);
  const early = dayNumber(date.getMonth() + 1, date.getDate()) <= dayNumber(...season.to);
  return `${season.id}-${date.getFullYear() - (crossesYear && early ? 1 : 0)}`;
}

/** The season to show, given the setting and the ones skipped this year. */
export function seasonNow(date: Date, choice: SeasonChoice, skipped: string[] = []): Season | null {
  if (choice === 'off') return null;
  if (choice === 'on') return SEASONS[0] ?? null;
  return SEASONS.find((s) => inWindow(s, date) && !skipped.includes(skipMark(s, date))) ?? null;
}

/** Paints the frame, or puts it back to normal. */
export function applySeason(season: Season | null): void {
  if (season) document.documentElement.dataset.season = season.id;
  else delete document.documentElement.dataset.season;
}
