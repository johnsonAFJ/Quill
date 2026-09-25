import { describe, expect, it } from 'vitest';
import { addCut, parseCuts, removeCut } from './cuts';

const MONDAY = new Date('2026-09-21T21:14:00');
const TUESDAY = new Date('2026-09-22T08:02:00');

describe('setting text aside', () => {
  it('starts a cuts file with an explanation and the first piece', () => {
    const file = addCut('', 'The tide went out.', MONDAY);
    expect(file).toContain('# Cuts');
    expect(parseCuts(file)).toEqual([{ when: 'Mon, Sep 21 · 9:14 PM', text: 'The tide went out.', words: 4, index: 1 }]);
  });

  it('puts later cuts on top and keeps the earlier ones', () => {
    const file = addCut(addCut('', 'First piece.', MONDAY), 'Second piece.', TUESDAY);
    expect(parseCuts(file).map((c) => c.text)).toEqual(['Second piece.', 'First piece.']);
    expect(file.indexOf('# Cuts')).toBe(0);
  });

  it('keeps every line of what you set aside', () => {
    const piece = 'One line.\n\nAnother line, after a gap.';
    expect(parseCuts(addCut('', piece, MONDAY))[0]!.text).toBe(piece);
  });

  it('ignores an empty selection', () => {
    expect(addCut('', '   \n ', MONDAY)).toBe('');
  });
});

describe('taking a cut out', () => {
  const two = addCut(addCut('', 'First piece.', MONDAY), 'Second piece.', TUESDAY);

  it('leaves the others alone', () => {
    const left = parseCuts(removeCut(two, parseCuts(two)[0]!.index));
    expect(left.map((c) => c.text)).toEqual(['First piece.']);
  });

  it('empties the file once the last cut is gone', () => {
    const one = removeCut(two, parseCuts(two)[0]!.index);
    expect(removeCut(one, parseCuts(one)[0]!.index)).toBe('');
  });

  it('won’t touch the file if the index isn’t a cut', () => {
    expect(removeCut(two, 0)).toBe(two);
  });
});
