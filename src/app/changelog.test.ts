import { describe, expect, it } from 'vitest';
import { parseChangelog, readyUpdates, unseen } from './changelog';

const LOG = `# What's new

Intro text.

## Sep 22 · Three
- c1
- c2

## Sep 21 · Two
- b1

## Sep 20 · One
- a1
`;

describe('parseChangelog', () => {
  it('reads each "##" heading as an update with its bullet points', () => {
    expect(parseChangelog(LOG)).toEqual([
      { title: 'Sep 22 · Three', items: ['c1', 'c2'] },
      { title: 'Sep 21 · Two', items: ['b1'] },
      { title: 'Sep 20 · One', items: ['a1'] },
    ]);
  });
});

describe('unseen', () => {
  const updates = parseChangelog(LOG);
  it('shows everything newer than the last update this device saw', () => {
    expect(unseen(updates, 'Sep 20 · One').map((u) => u.title)).toEqual(['Sep 22 · Three', 'Sep 21 · Two']);
  });
  it('shows nothing once the latest has been seen', () => {
    expect(unseen(updates, 'Sep 22 · Three')).toEqual([]);
  });
  it('shows only the latest on a fresh install', () => {
    expect(unseen(updates, null).map((u) => u.title)).toEqual(['Sep 22 · Three']);
  });
});

describe('updates that wait for a season', () => {
  const log = `# What's new

## 🎃 A costume <!-- with season: halloween -->
- spooky

## Sep 22 · Three
- c1
`;
  const all = parseChangelog(log);

  it('reads the marker off the heading and keeps the title clean', () => {
    expect(all[0]).toEqual({ title: '🎃 A costume', items: ['spooky'], season: 'halloween' });
    expect(all[1]!.season).toBeUndefined();
  });

  it('stays hidden until its season is showing', () => {
    expect(readyUpdates(all, null).map((u) => u.title)).toEqual(['Sep 22 · Three']);
    expect(readyUpdates(all, { id: 'halloween' }).map((u) => u.title)).toEqual(['🎃 A costume', 'Sep 22 · Three']);
  });

  it('is the newest thing once it shows, so it pops up on its own', () => {
    const showing = readyUpdates(all, { id: 'halloween' });
    expect(unseen(showing, 'Sep 22 · Three').map((u) => u.title)).toEqual(['🎃 A costume']);
  });
});
