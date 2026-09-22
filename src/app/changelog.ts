// "What's new": the updates in CHANGELOG.md, and which ones this device has seen.

import changelog from '../../CHANGELOG.md?raw';
import { prefs } from './device';

export type Update = { title: string; items: string[] };

export function parseChangelog(text: string): Update[] {
  const updates: Update[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) updates.push({ title: line.slice(3).trim(), items: [] });
    else if (line.startsWith('- ') && updates.length > 0) updates[updates.length - 1]!.items.push(line.slice(2).trim());
  }
  return updates;
}

/** The updates newer than `seen` (newest first). With nothing seen yet, just the latest. */
export function unseen(updates: Update[], seen: string | null): Update[] {
  if (updates.length === 0) return [];
  const index = seen === null ? -1 : updates.findIndex((u) => u.title === seen);
  return index === -1 ? updates.slice(0, 1) : updates.slice(0, index);
}

export const updates = parseChangelog(changelog);

const SEEN = 'seenUpdate';

export function unseenUpdates(): Update[] {
  return unseen(updates, prefs.get<string | null>(SEEN, null));
}

export function markUpdatesSeen(): void {
  if (updates[0]) prefs.set(SEEN, updates[0].title);
}
