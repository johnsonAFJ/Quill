import { describe, expect, it } from 'vitest';
import { previewOf, safeFileName, titleOf, untitledName, wordCount } from './markdown';

describe('titleOf', () => {
  it('skips a comment at the top', () => {
    expect(titleOf('<!-- Prompt: a storm\nat sea -->\n# The Storm\nText')).toBe('The Storm');
    expect(previewOf('<!-- prompt -->\n# The Storm\nThe waves rose.')).toBe('The waves rose.');
  });

  it('takes the first non-empty line without Markdown symbols', () => {
    expect(titleOf('\n\n# The *First* Morning\n\nText')).toBe('The First Morning');
    expect(titleOf('> A quote')).toBe('A quote');
    expect(titleOf('')).toBe('');
  });
});

describe('previewOf', () => {
  it('joins the lines after the title', () => {
    expect(previewOf('# Title\n\nOne **two**.\n- three')).toBe('One two. three');
  });
});

describe('wordCount', () => {
  it('leaves comments out', () => {
    expect(wordCount('<!-- Prompt: write about a storm at sea. -->\n\nThe waves rose.')).toBe(3);
    expect(wordCount('Before <!-- aside --> after')).toBe(2);
  });

  it('counts words, not Markdown symbols', () => {
    expect(wordCount('# A title\n\nIt’s **very** [short](https://x.y) - really.')).toBe(6);
    expect(wordCount('')).toBe(0);
  });
});

describe('safeFileName', () => {
  it('removes characters files can’t have', () => {
    expect(safeFileName('What: a/b? "day"')).toBe('What a b day');
    expect(safeFileName('.hidden')).toBe('hidden');
    expect(safeFileName('   ')).toBe('');
  });
});

describe('untitledName', () => {
  it('includes the date and time', () => {
    expect(untitledName(new Date('2026-09-21T14:32:00'))).toBe('Untitled 2026-09-21 1432');
  });
});
