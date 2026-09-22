import { describe, expect, it } from 'vitest';
import { appendQuickNote } from './quickNotes';

const AT = new Date('2026-09-22T21:14:00');

describe('appendQuickNote', () => {
  it('starts the sheet with a title the first time', () => {
    expect(appendQuickNote(undefined, '  A lighthouse with no light.  ', AT)).toBe('# Quick Notes\n\n**Tue, Sep 22 · 9:14 PM**\nA lighthouse with no light.\n');
  });

  it('adds to the bottom and leaves everything above as it was', () => {
    const before = '# Quick Notes\n\n**Mon, Sep 21 · 8:00 AM**\nFirst thought.\n\n\n';
    expect(appendQuickNote(before, 'Second thought.', AT)).toBe('# Quick Notes\n\n**Mon, Sep 21 · 8:00 AM**\nFirst thought.\n\n**Tue, Sep 22 · 9:14 PM**\nSecond thought.\n');
  });

  it('keeps line breaks inside a note', () => {
    expect(appendQuickNote('# Quick Notes\n', 'Line one\nLine two', AT)).toBe('# Quick Notes\n\n**Tue, Sep 22 · 9:14 PM**\nLine one\nLine two\n');
  });
});
