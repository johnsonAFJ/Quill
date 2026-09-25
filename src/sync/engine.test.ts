import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './engine';
import { FakeDropbox, MemoryStore } from './memory';
import { keyOf } from './paths';

let dropbox: FakeDropbox;
let clock: number;
const now = () => clock;

function device(name = 'Mac', store = new MemoryStore()) {
  return { engine: new Engine(store, dropbox, name, now), store };
}

async function started(name = 'Mac') {
  const d = device(name);
  await d.engine.load();
  await d.engine.sync();
  return d.engine;
}

const LONG = 'It was six o’clock in the morning when the settlers set out. '.repeat(10);

beforeEach(() => {
  dropbox = new FakeDropbox();
  clock = new Date('2026-09-21T14:32:00').getTime();
});

describe('first sync', () => {
  it('downloads every sheet but leaves the app’s own files alone', async () => {
    dropbox.write('/Essays/On Walking.md', '# On Walking\n\nSlowly.');
    dropbox.write('/_quill/backups/Old.md', 'backup');
    const engine = await started();
    expect(engine.get(keyOf('/Essays/On Walking.md'))?.text).toBe('# On Walking\n\nSlowly.');
    expect(engine.get(keyOf('/Essays'))?.kind).toBe('folder');
    expect(engine.get(keyOf('/_quill/backups/Old.md'))).toBeUndefined();
    expect(engine.status.pending).toBe(0);
  });
});

describe('editing', () => {
  it('sends edits to Dropbox and nothing else', async () => {
    dropbox.write('/A.md', 'a');
    dropbox.write('/B.md', 'b');
    const engine = await started();
    let uploads = 0;
    const upload = dropbox.upload.bind(dropbox);
    dropbox.upload = (...args) => (uploads++, upload(...args));

    engine.setText(keyOf('/A.md'), 'a, edited');
    await engine.sync();
    expect(dropbox.text('/A.md')).toBe('a, edited');
    expect(dropbox.text('/B.md')).toBe('b');
    expect(uploads).toBe(1);
    expect(engine.status.pending).toBe(0);
  });

  it('keeps offline edits on the device and sends them later', async () => {
    dropbox.write('/A.md', 'a');
    const { engine, store } = device();
    await engine.load();
    await engine.sync();

    dropbox.offline = true;
    engine.setText(keyOf('/A.md'), 'written on a plane');
    await engine.sync();
    expect(engine.status.error).toMatch(/Offline/);
    expect(engine.status.pending).toBe(1);

    // The app is closed and reopened before the signal comes back.
    const reopened = new Engine(store, dropbox, 'Mac', now);
    await reopened.load();
    expect(reopened.get(keyOf('/A.md'))?.text).toBe('written on a plane');

    dropbox.offline = false;
    await reopened.sync();
    expect(dropbox.text('/A.md')).toBe('written on a plane');
    expect(reopened.status.pending).toBe(0);
  });

  it('picks up changes made on another device', async () => {
    dropbox.write('/A.md', 'a');
    const engine = await started();
    dropbox.write('/A.md', 'changed on the iPad');
    dropbox.write('/New.md', 'new');
    await engine.sync();
    expect(engine.get(keyOf('/A.md'))?.text).toBe('changed on the iPad');
    expect(engine.get(keyOf('/New.md'))?.text).toBe('new');
  });
});

describe('conflicts', () => {
  it('keeps both versions when a sheet changed on two devices', async () => {
    dropbox.write('/Story.md', 'original');
    const phone = await started('iPhone');
    const laptop = await started('Mac');

    phone.setText(keyOf('/Story.md'), 'phone version');
    laptop.setText(keyOf('/Story.md'), 'laptop version');
    await laptop.sync();
    await phone.sync();

    expect(dropbox.text('/Story.md')).toBe('laptop version');
    expect(dropbox.text('/Story (conflict, iPhone, Sep 21).md')).toBe('phone version');
    expect(phone.get(keyOf('/Story.md'))?.text).toBe('laptop version');
    expect(phone.get(keyOf('/Story (conflict, iPhone, Sep 21).md'))?.text).toBe('phone version');
    expect(phone.status.pending).toBe(0);
  });

  it('doesn’t make a conflict copy when both devices typed the same thing', async () => {
    dropbox.write('/Story.md', 'original');
    const phone = await started('iPhone');
    const laptop = await started('Mac');
    phone.setText(keyOf('/Story.md'), 'same');
    laptop.setText(keyOf('/Story.md'), 'same');
    await laptop.sync();
    await phone.sync();
    expect(dropbox.paths()).toEqual(['/Story.md']);
  });

  it('brings a sheet back if it was deleted elsewhere while edited here', async () => {
    dropbox.write('/Story.md', 'original');
    const engine = await started();
    engine.setText(keyOf('/Story.md'), 'my edits');
    dropbox.delete('/Story.md');
    await engine.sync();
    expect(dropbox.text('/Story.md')).toBe('my edits');
  });
});

describe('safety', () => {
  it('backs up a sheet before saving it almost empty', async () => {
    dropbox.write('/Story.md', LONG);
    const engine = await started();
    engine.setText(keyOf('/Story.md'), 'x');
    await engine.sync();
    expect(dropbox.text('/Story.md')).toBe('x');
    const backup = dropbox.paths().find((p) => p.startsWith('/_quill/backups/Story (before emptying'));
    expect(backup).toBeDefined();
    expect(dropbox.text(backup!)).toBe(LONG);
  });

  it('moves deleted sheets to Trash and can put them back', async () => {
    dropbox.write('/Essays/On Walking.md', 'walk');
    dropbox.write('/Essays/On Walking.notes.md', '## Ideas');
    const engine = await started();

    const trashed = engine.trash(keyOf('/Essays/On Walking.md'))!;
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/_Trash/On Walking.md', '/_Trash/On Walking.notes.md']);
    expect(engine.get(trashed)?.trashedFrom).toBe('/Essays');

    engine.restore(trashed);
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Essays/On Walking.md', '/Essays/On Walking.notes.md']);
  });

  it('takes a sheet’s cuts along to Trash and back', async () => {
    dropbox.write('/Essays/On Walking.md', 'walk');
    dropbox.write('/Essays/On Walking.cuts.md', '## Mon, Sep 21 · 9:14 PM\nA sentence I set aside.');
    const engine = await started();

    const trashed = engine.trash(keyOf('/Essays/On Walking.md'))!;
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/_Trash/On Walking.cuts.md', '/_Trash/On Walking.md']);

    engine.restore(trashed);
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Essays/On Walking.cuts.md', '/Essays/On Walking.md']);
  });

  it('renames a sheet’s cuts with it', async () => {
    dropbox.write('/Essays/Draft.md', 'draft');
    dropbox.write('/Essays/Draft.cuts.md', '## Mon, Sep 21 · 9:14 PM\nSet aside.');
    const engine = await started();
    engine.rename(keyOf('/Essays/Draft.md'), 'On Walking');
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Essays/On Walking.cuts.md', '/Essays/On Walking.md']);
  });

  it('never replaces an existing sheet when moving to Trash', async () => {
    dropbox.write('/_Trash/Draft.md', 'older draft');
    dropbox.write('/Draft.md', 'newer draft');
    const engine = await started();
    engine.trash(keyOf('/Draft.md'));
    await engine.sync();
    expect(dropbox.text('/_Trash/Draft.md')).toBe('older draft');
    expect(dropbox.paths()).toContain('/_Trash/Draft 2.md');
    expect(dropbox.text('/_Trash/Draft 2.md')).toBe('newer draft');
  });
});

describe('deleting permanently', () => {
  it('deletes a sheet and its notes from Trash', async () => {
    dropbox.write('/Essays/Draft.md', 'draft');
    dropbox.write('/Essays/Draft.notes.md', '## Idea');
    dropbox.write('/Essays/Keep.md', 'keep');
    const engine = await started();
    const trashed = engine.trash(keyOf('/Essays/Draft.md'))!;
    await engine.sync();
    expect(engine.deletePermanently(trashed)).toBe(true);
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Essays/Keep.md']);
    expect(dropbox.removed).toEqual(['/_Trash/Draft.md', '/_Trash/Draft.notes.md']);
    expect(engine.get(trashed)).toBeUndefined();
  });

  it('deletes a sheet’s cuts with it', async () => {
    dropbox.write('/Essays/Draft.md', 'draft');
    dropbox.write('/Essays/Draft.notes.md', '## Idea');
    dropbox.write('/Essays/Draft.cuts.md', '## Mon, Sep 21 · 9:14 PM\nSet aside.');
    const engine = await started();
    const trashed = engine.trash(keyOf('/Essays/Draft.md'))!;
    await engine.sync();
    expect(engine.deletePermanently(trashed)).toBe(true);
    await engine.sync();
    expect(dropbox.paths()).toEqual([]);
    expect(dropbox.removed).toEqual(['/_Trash/Draft.md', '/_Trash/Draft.notes.md', '/_Trash/Draft.cuts.md']);
  });

  it('deletes a whole group in Trash', async () => {
    dropbox.write('/Poems/Rain.md', 'rain');
    const engine = await started();
    const trashed = engine.trash(keyOf('/Poems'))!;
    await engine.sync();
    engine.deletePermanently(trashed);
    await engine.sync();
    expect(dropbox.paths()).toEqual([]);
    expect(dropbox.removed).toEqual(['/_Trash/Poems']);
  });

  it('refuses anything outside Trash, and Trash itself', async () => {
    dropbox.write('/Essays/Keep.md', 'keep');
    dropbox.write('/_Trash/Old.md', 'old');
    const engine = await started();
    expect(engine.deletePermanently(keyOf('/Essays/Keep.md'))).toBe(false);
    expect(engine.deletePermanently(keyOf('/Essays'))).toBe(false);
    expect(engine.deletePermanently(keyOf('/_Trash'))).toBe(false);
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Essays/Keep.md', '/_Trash/Old.md']);
    expect(dropbox.removed).toEqual([]);
    await expect(dropbox.remove('/Essays/Keep.md')).rejects.toThrow(/only deletes from Trash/);
  });

  it('never sends something to Dropbox just to delete it', async () => {
    const engine = await started();
    const sheet = engine.createSheet('');
    engine.setText(sheet.key, 'Typed offline');
    const trashed = engine.trash(sheet.key)!;
    engine.deletePermanently(trashed);
    await engine.sync();
    expect(dropbox.paths()).toEqual([]);
    expect(dropbox.removed).toEqual([]);
  });
});

describe('new sheets and groups', () => {
  it('names a new sheet once from its first line', async () => {
    const engine = await started();
    const sheet = engine.createSheet('');
    expect(sheet.path).toBe('/Untitled 2026-09-21 1432.md');
    engine.setText(sheet.key, '# The Lighthouse\n\nA beam across the water.');
    const key = engine.finishEditing(sheet.key)!;
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/The Lighthouse.md']);

    // Changing the first line later doesn't rename the file.
    engine.setText(key, '# The Old Lighthouse\n\nA beam across the water.');
    expect(engine.finishEditing(key)).toBe(key);
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/The Lighthouse.md']);
  });

  it('names an "Untitled" sheet made on another device when you leave it', async () => {
    dropbox.write('/Stories/Untitled 2026-09-21 1319.md', '# The Backroom of the Shop\n\nIt takes my eyes a moment.');
    dropbox.write('/Stories/Untitled 2026-09-21 1319.notes.md', '## Critique\nGood.');
    dropbox.write('/Stories/Untitled 2026-09-21 1320.md', '');
    const engine = await started();
    engine.finishEditing(keyOf('/Stories/Untitled 2026-09-21 1319.md'));
    expect(engine.finishEditing(keyOf('/Stories/Untitled 2026-09-21 1320.md'))).toBe(keyOf('/Stories/Untitled 2026-09-21 1320.md'));
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Stories/The Backroom of the Shop.md', '/Stories/The Backroom of the Shop.notes.md', '/Stories/Untitled 2026-09-21 1320.md']);
  });

  it('throws away a new sheet that was left empty', async () => {
    const engine = await started();
    const sheet = engine.createSheet('');
    expect(engine.finishEditing(sheet.key)).toBeNull();
    await engine.sync();
    expect(dropbox.paths()).toEqual([]);
    expect(engine.get(sheet.key)).toBeUndefined();
  });

  it('keeps the notes of a new sheet that was left empty', async () => {
    const engine = await started();
    const sheet = engine.createSheet('');
    engine.writeFile(sheet.path.replace(/\.md$/, '.notes.md'), '## Idea\nKeep this.\n');
    await engine.sync();
    expect(engine.finishEditing(sheet.key)).toBeNull();
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/_Trash/Untitled 2026-09-21 1432.notes.md']);
  });

  it('creates and renames a group before it ever reaches Dropbox', async () => {
    const engine = await started();
    const group = engine.createGroup('', 'Stories')!;
    const sheet = engine.createSheet(group.path);
    engine.setText(sheet.key, 'Once');
    engine.rename(group.key, 'Short Stories');
    await engine.sync();
    expect(dropbox.nodes.has(keyOf('/Stories'))).toBe(false);
    expect(dropbox.paths()).toEqual(['/Short Stories/Untitled 2026-09-21 1432.md']);
  });

  it('creates a notes file next to its sheet on first write', async () => {
    dropbox.write('/Essays/Story.md', 'text');
    const engine = await started();
    engine.writeFile('/Essays/Story.notes.md', '## Idea\nA lighthouse.\n');
    await engine.sync();
    expect(dropbox.text('/Essays/Story.notes.md')).toBe('## Idea\nA lighthouse.\n');
    engine.writeFile('/Essays/Story.notes.md', '## Idea\nTwo lighthouses.\n');
    await engine.sync();
    expect(dropbox.text('/Essays/Story.notes.md')).toBe('## Idea\nTwo lighthouses.\n');
  });

  it('renames a synced sheet together with its notes', async () => {
    dropbox.write('/Draft.md', 'text');
    dropbox.write('/Draft.notes.md', 'notes');
    const engine = await started();
    engine.rename(keyOf('/Draft.md'), 'Final');
    await engine.sync();
    expect(dropbox.paths()).toEqual(['/Final.md', '/Final.notes.md']);
    expect(engine.status.pending).toBe(0);
  });
});
