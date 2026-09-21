import { describe, expect, it } from 'vitest';
import { buildLibrary, roleOf, type Entry } from './tree';

const file = (path: string): Entry => ({ kind: 'file', path });
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
    file('/Essays/_Notes.md'),
    file('/Essays/On Walking.md'),
    file('/Essays/On Walking.notes.md'),
    folder('/Essays/Stories'),
    file('/Essays/Stories/The Lighthouse.md'),
    file('/Loose Idea.md'),
    file('/cover.png'),
    folder('/_Trash'),
    file('/_Trash/Old Draft.md'),
    folder('/_quill'),
    folder('/_quill/backups'),
    file('/_quill/backups/On Walking.md'),
  ]);

  it('turns folders into nested groups and .md files into sheets', () => {
    expect(library.root.sheets.map((s) => s.name)).toEqual(['Loose Idea']);
    const essays = library.root.groups[0]!;
    expect(essays.name).toBe('Essays');
    expect(essays.sheets.map((s) => s.name)).toEqual(['On Walking']);
    expect(essays.groups[0]!.sheets.map((s) => s.name)).toEqual(['The Lighthouse']);
  });

  it('hides notes files but marks what has notes', () => {
    const essays = library.root.groups[0]!;
    expect(essays.hasNotes).toBe(true);
    expect(essays.sheets[0]!.hasNotes).toBe(true);
    expect(essays.groups[0]!.sheets[0]!.hasNotes).toBe(false);
  });

  it('keeps Trash separate and never shows the app’s own files', () => {
    expect(library.trash.map((s) => s.name)).toEqual(['Old Draft']);
    expect(library.root.groups.map((g) => g.name)).toEqual(['Essays']);
  });
});
