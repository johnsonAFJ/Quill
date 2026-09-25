import { describe, expect, it } from 'vitest';
import { pieceAt, piecesOf } from './speech';

describe('what gets read out loud', () => {
  it('reads the prose and skips comments', () => {
    const text = '# The Sea\n\n<!-- Prompt: write something -->\n\nThe tide went out.';
    expect(piecesOf(text).map((p) => p.say)).toEqual(['The Sea', 'The tide went out.']);
  });

  it('leaves Markdown symbols unsaid', () => {
    expect(piecesOf('## A **bold** word and a [link](https://example.com).')[0]!.say).toBe('A bold word and a link.');
  });

  it('joins the lines of a paragraph but keeps paragraphs apart', () => {
    expect(piecesOf('One line\nand its rest.\n\nA new paragraph.').map((p) => p.say)).toEqual(['One line and its rest.', 'A new paragraph.']);
  });

  it('breaks a long paragraph into sentence-sized pieces', () => {
    const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} runs on for a little while.`).join(' ');
    const pieces = piecesOf(long);
    expect(pieces.length).toBeGreaterThan(1);
    expect(Math.max(...pieces.map((p) => p.say.length))).toBeLessThan(330);
  });

  it('knows which piece the cursor is in, so reading starts there', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const pieces = piecesOf(text);
    expect(pieces[pieceAt(pieces, text.indexOf('Second'))]!.say).toBe('Second paragraph.');
    expect(pieces[pieceAt(pieces, text.indexOf('Third') + 2)]!.say).toBe('Third paragraph.');
    expect(pieceAt(pieces, 0)).toBe(0);
  });

  it('has nothing to read in an empty sheet', () => {
    expect(piecesOf('\n\n<!-- only a comment -->\n')).toEqual([]);
  });
});
