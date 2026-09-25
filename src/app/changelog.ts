// "What's new": the updates in CHANGELOG.md, and which ones this device has seen.

import changelog from '../../CHANGELOG.md?raw';
import { prefs } from './device';
import { seasonNow, type SeasonChoice, type SeasonId } from './season';

/**
 * An update. One waiting on a season is written with a marker on its heading:
 *
 *   ## 🎃 Quill puts on a costume <!-- with season: halloween -->
 *
 * It ships with the app but stays out of "What's new" until that season is
 * actually showing, so the surprise announces itself on the day and not before.
 */
export type Update = { title: string; items: string[]; season?: SeasonId };

const WITH_SEASON = /\s*<!--\s*with season:\s*([a-z]+)\s*-->\s*$/;

export function parseChangelog(text: string): Update[] {
  const updates: Update[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      const marked = heading.match(WITH_SEASON);
      updates.push(marked ? { title: heading.replace(WITH_SEASON, '').trim(), items: [], season: marked[1] as SeasonId } : { title: heading, items: [] });
    } else if (line.startsWith('- ') && updates.length > 0) updates[updates.length - 1]!.items.push(line.slice(2).trim());
  }
  return updates;
}

/** The updates worth showing today: everything, minus the ones whose season hasn't come. */
export function readyUpdates(all: Update[], season: { id: SeasonId } | null): Update[] {
  return all.filter((u) => !u.season || u.season === season?.id);
}

/** The updates newer than `seen` (newest first). With nothing seen yet, just the latest. */
export function unseen(updates: Update[], seen: string | null): Update[] {
  if (updates.length === 0) return [];
  const index = seen === null ? -1 : updates.findIndex((u) => u.title === seen);
  return index === -1 ? updates.slice(0, 1) : updates.slice(0, index);
}

/**
 * The season by the calendar. A preview ("show me now") deliberately doesn't
 * count: looking at a season early shouldn't hand you its announcement too.
 */
function seasonToday() {
  const choice = prefs.get<SeasonChoice>('season', 'auto');
  return seasonNow(new Date(), choice === 'off' ? 'off' : 'auto', prefs.get<string[]>('seasonsSkipped', []));
}

export const updates = readyUpdates(parseChangelog(changelog), seasonToday());

const SEEN = 'seenUpdate';

export function unseenUpdates(): Update[] {
  return unseen(updates, prefs.get<string | null>(SEEN, null));
}

export function markUpdatesSeen(): void {
  if (updates[0]) prefs.set(SEEN, updates[0].title);
}
