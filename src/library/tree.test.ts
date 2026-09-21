import { describe, expect, it } from 'vitest';
import { buildLibrary, roleOf, sortSheets, type Entry } from './tree';

const file = (path: string, text = '', modified = 0): Entry => ({ kind: 'file', path, text, modified });
const folder = (path: string): Entry => ({ kind: 'folder', path });

describe('roleOf', () => {
  it('recognizes sheets, notes and the app’s own folders', () => {
    expect(roleOf('On Walking.md', 'file')).toBe('sheet');
    expect(roleOf('On Walking.MD', 'file')).toBe('sheet');
    expect(roleOf('On Walking.notes.md', 'file')).toBe('sheetNotes');
    expect(roleOf('_Notes.md', 'file')).toBe('groupNotes');
    expect(roleOf('photo.jpg', 'file')).toBe('other');
    expect(roleOf('Essays', 'folder')).toBe('group');
    expect(roleOf('_Trash', 'folder')).toBe('trash');
    expect(roleOf('_quill', 'folder')).toBe('hidden');
  });
});

describe('buildLibrary', () => {
  const library = buildLibrary([
    folder('/Essays'),
    file('/Essays/_Notes.md', '## Theme\nWalking.'),
    file('/Essays/On Walking.md', '# On Walking\n\nI walk *slowly*.\nEvery day.'),
    file('/Essays/On Walking.notes.md', '## Ideas\nSlow.'),
    file('/Essays/Stories/The Lighthouse.notes.md', '\n'),
    file('/Essays/On Walking (conflict, iPhone, Sep 21).md', 'other'),
    folder('/Essays/Stories'),
    file('/Essays/Stories/The Lighthouse.md'),
    file('/Loose Idea.md'),
    file('/cover.png'),
    folder('/_Trash'),
    file('/_Trash/Old Draft.md'),
    folder('/_Trash/Poems'),
    file('/_Trash/Poems/Rain.md'),
    folder('/_quill'),
    folder('/_quill/backups'),
    file('/_quill/backups/On Walking.md'),
  ]);

  it('turns folders into nested groups and .md files into sheets', () => {
    expect(library.root.sheets.map((s) => s.name)).toEqual(['Loose Idea']);
    const essays = library.root.groups[0]!;
    expect(essays.name).toBe('Essays');
    expect(essays.groups[0]!.sheets.map((s) => s.name)).toEqual(['The Lighthouse']);
  });

  it('uses the first line as the title and the rest as a preview', () => {
    const sheet = library.sheets.get('/essays/on walking.md')!;
    expect(sheet.title).toBe('On Walking');
    expect(sheet.preview).toBe('I walk slowly. Every day.');
    expect(library.sheets.get('/loose idea.md')!.title).toBe('Loose Idea');
  });

  it('hides notes files but marks sheets whose notes aren’t empty', () => {
    const essays = library.root.groups[0]!;
    expect(essays.hasNotes).toBe(true);
    expect(library.sheets.get('/essays/on walking.md')!.hasNotes).toBe(true);
    expect(library.sheets.get('/essays/stories/the lighthouse.md')!.hasNotes).toBe(false);
  });

  it('links conflict copies to their sheet', () => {
    expect(library.sheets.get('/essays/on walking.md')!.conflicts).toEqual(['/essays/on walking (conflict, iphone, sep 21).md']);
  });

  it('keeps Trash separate and never shows the app’s own files', () => {
    expect(library.trash.map((s) => s.name)).toEqual(['Old Draft']);
    expect(library.trashGroups).toEqual([{ key: '/_trash/poems', name: 'Poems', path: '/_Trash/Poems', sheetCount: 1 }]);
    expect(library.root.groups.map((g) => g.name)).toEqual(['Essays']);
  });
});

describe('sortSheets', () => {
  const { root } = buildLibrary([file('/10 End.md', '', 1), file('/2 Middle.md', '', 3), file('/1 Start.md', '', 2)]);
  it('sorts by last edited, newest first', () => {
    expect(sortSheets(root.sheets, 'edited').map((s) => s.name)).toEqual(['2 Middle', '1 Start', '10 End']);
  });
  it('sorts by name with numbers in order', () => {
    expect(sortSheets(root.sheets, 'name').map((s) => s.name)).toEqual(['1 Start', '2 Middle', '10 End']);
  });
});
