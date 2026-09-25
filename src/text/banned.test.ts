import { describe, expect, it } from 'vitest';
import { bannedPattern, parseBannedList, tallyBanned, tallyLabel } from './banned';

const LIST = `# Banned words

Notes to self here.

- very
- just
started to
`;

describe('the list', () => {
  it('reads one word a line, with or without a dash', () => {
    expect(parseBannedList(LIST)).toEqual(['very', 'just', 'started to']);
  });

  it('leaves your notes to yourself out of it', () => {
    expect(parseBannedList('# Banned words\n\nThese are the words I lean on when I am tired.\n\n- very\n')).toEqual(['very']);
  });

  it('is empty until you write one', () => {
    expect(parseBannedList(undefined)).toEqual([]);
    expect(parseBannedList('# Banned words\n\n')).toEqual([]);
  });
});

describe('finding them in the writing', () => {
  const words = parseBannedList(LIST);

  it('counts whole words only', () => {
    const text = 'It was very, very quiet. She just adjusted the just-so pillow.';
    // A tie reads alphabetically.
    expect(tallyBanned(text, words)).toEqual([
      { word: 'just', count: 2 },
      { word: 'very', count: 2 },
    ]);
  });

  it('doesn’t light up inside another word', () => {
    expect(tallyBanned('He adjusted the lever. Adversity.', words)).toEqual([]);
  });

  it('catches a phrase however it’s spaced', () => {
    expect(tallyBanned('She started to run. He\nstarted to walk.', words)).toEqual([{ word: 'started to', count: 2 }]);
  });

  it('ignores your comments', () => {
    expect(tallyBanned('<!-- very just -->\nQuiet.', words)).toEqual([]);
  });

  it('writes the tally the way the footer shows it', () => {
    expect(tallyLabel(tallyBanned('very very just', words))).toBe('very ×2 · just ×1');
  });

  it('has no pattern at all for an empty list', () => {
    expect(bannedPattern([])).toBeNull();
  });
});
