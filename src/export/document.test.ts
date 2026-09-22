import { describe, expect, it } from 'vitest';
import { cssString, exportDocument, manuscriptWords } from './document';
import { markLeads } from './styles';

describe('exportDocument', () => {
  it('uses a leading heading as the title and leaves out comments', () => {
    const doc = exportDocument('<!-- Prompt: a storm -->\n\n# The Storm\n\nThe waves *rose*.\n', 'Untitled');
    expect(doc.title).toBe('The Storm');
    expect(doc.bodyHtml).toBe('<p>The waves <em>rose</em>.</p>\n');
    expect(doc.words).toBe(3);
  });

  it('keeps an opening sentence that isn’t a heading, and uses the sheet name as the title', () => {
    const doc = exportDocument('It was dark.\n\nThen light.', 'Night');
    expect(doc.title).toBe('Night');
    expect(doc.bodyHtml).toContain('<p>It was dark.</p>');
  });

  it('turns ***, --- and * * * into scene breaks', () => {
    const doc = exportDocument('# T\n\nOne.\n\n***\n\nTwo.\n\n* * *\n\nThree.', 'x');
    expect(doc.bodyHtml.match(/scene-break/g)).toHaveLength(2);
  });

  it('shows HTML typed in a sheet as text instead of running it', () => {
    const doc = exportDocument('# T\n\n<script>alert(1)</script>\n\nA <b>tag</b>.', 'x');
    expect(doc.bodyHtml).not.toContain('<script>');
    expect(doc.bodyHtml).toContain('&lt;script&gt;');
  });
});

describe('manuscriptWords', () => {
  it('rounds to the nearest hundred, like a manuscript', () => {
    expect(manuscriptWords(2348)).toBe('about 2,300 words');
    expect(manuscriptWords(2351)).toBe('about 2,400 words');
    expect(manuscriptWords(42)).toBe('42 words');
  });
  it('gives the exact count when asked', () => {
    expect(manuscriptWords(2540, false)).toBe('2,540 words');
    expect(manuscriptWords(1, false)).toBe('1 word');
  });
});

describe('cssString', () => {
  it('quotes text safely for a page header', () => {
    expect(cssString('The "Big" \\ Night')).toBe('"The \\"Big\\" \\\\ Night"');
  });
});

describe('markLeads', () => {
  it('marks the opening paragraph and the first after each scene break or heading', () => {
    const { bodyHtml } = exportDocument('# T\n\nOne.\n\nTwo.\n\n***\n\nThree.\n\n## Later\n\nFour.\n\nFive.', 'x');
    expect(markLeads(bodyHtml).match(/<p[^>]*>/g)).toEqual([
      '<p class="lead opening">',
      '<p>',
      '<p class="scene-break" aria-hidden="true">',
      '<p class="lead">',
      '<p class="lead">',
      '<p>',
    ]);
  });
});
