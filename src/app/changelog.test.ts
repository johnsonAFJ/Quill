import { describe, expect, it } from 'vitest';
import { parseChangelog, unseen } from './changelog';

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
