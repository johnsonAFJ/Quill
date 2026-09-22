import { describe, expect, it } from 'vitest';
import { KEEP, MemorySnapshotStore, Snapshots } from './snapshots';

function setup() {
  let clock = 1_000;
  const store = new MemorySnapshotStore();
  const snapshots = new Snapshots(store, () => (clock += 1000));
  return { store, snapshots };
}

describe('Snapshots', () => {
  it('saves a copy with its word count', async () => {
    const { snapshots } = setup();
    expect(await snapshots.capture('a', 'One two three.', 'opened')).toBe(true);
    const [only] = await snapshots.list('a');
    expect(only).toMatchObject({ fileId: 'a', text: 'One two three.', words: 3, why: 'opened' });
  });

  it('skips empty text and copies identical to the latest', async () => {
    const { snapshots } = setup();
    expect(await snapshots.capture('a', '   ', 'opened')).toBe(false);
    await snapshots.capture('a', 'Draft', 'opened');
    expect(await snapshots.capture('a', 'Draft', 'opened')).toBe(false);
    await snapshots.capture('a', 'Draft, revised', 'opened');
    expect((await snapshots.list('a')).map((s) => s.text)).toEqual(['Draft, revised', 'Draft']);
  });

  it(`keeps only the latest ${KEEP} for each sheet`, async () => {
    const { snapshots } = setup();
    for (let i = 1; i <= KEEP + 5; i++) await snapshots.capture('a', `Version ${i}`, 'opened');
    await snapshots.capture('b', 'Other sheet', 'opened');
    const kept = await snapshots.list('a');
    expect(kept).toHaveLength(KEEP);
    expect(kept[0]!.text).toBe(`Version ${KEEP + 5}`);
    expect(kept[KEEP - 1]!.text).toBe('Version 6');
    expect(await snapshots.list('b')).toHaveLength(1);
  });
});
