import { describe, expect, it } from 'vitest';
import { changeLevel, insertSection, moveSection, outlineOf, removeSection, renameHeading, sectionText } from './outline';

const SHEET = `# Red Rising

## Intro

### Eo gets hung

She sings.

### Darrow gets saved

## Becoming Gold

### Darrow learns about the Institute

### Darrow passes the test
`;

const titles = (text: string) => outlineOf(text).map((h) => `${'  '.repeat(h.depth)}${h.number}. ${h.title}`);

describe('reading the outline', () => {
  it('skips the sheet’s own title and numbers the rest I / A / 1', () => {
    expect(titles(SHEET)).toEqual([
      'I. Intro',
      '  A. Eo gets hung',
      '  B. Darrow gets saved',
      'II. Becoming Gold',
      '  A. Darrow learns about the Institute',
      '  B. Darrow passes the test',
    ]);
  });

  it('gives a section its heading and everything under it', () => {
    const intro = outlineOf(SHEET)[0]!;
    expect(sectionText(SHEET, intro)).toContain('She sings.');
    expect(sectionText(SHEET, intro)).not.toContain('Becoming Gold');
  });

  it('has nothing to show for a sheet without headings', () => {
    expect(outlineOf('Just some writing.\n\nAnd more.')).toEqual([]);
  });
});

describe('building the skeleton', () => {
  it('adds a section between two others, exactly where you asked', () => {
    const outline = outlineOf(SHEET);
    const afterFirstOfTwo = outline.findIndex((h) => h.title === 'Darrow learns about the Institute');
    const { text, at } = insertSection(SHEET, afterFirstOfTwo, 'Darrow gets carved');
    expect(titles(text)).toEqual([
      'I. Intro',
      '  A. Eo gets hung',
      '  B. Darrow gets saved',
      'II. Becoming Gold',
      '  A. Darrow learns about the Institute',
      '  B. Darrow gets carved',
      '  C. Darrow passes the test',
    ]);
    expect(text.slice(at)).toMatch(/^### Darrow gets carved/);
  });

  it('keeps a section you haven’t named yet, so it can be named next', () => {
    // Adding below "Intro" puts it after the whole of Intro; Tab in the panel then tucks it under.
    const { text, at } = insertSection(SHEET, 0, '');
    const added = outlineOf(text);
    const fresh = added.findIndex((h) => h.from === at);
    expect(added[fresh]).toMatchObject({ title: '', level: 2 });
    expect(text.slice(at)).toMatch(/^## /);
    expect(outlineOf(renameHeading(text, fresh, 'Part Two'))[fresh]!.title).toBe('Part Two');
    expect(outlineOf(changeLevel(text, fresh, 1))[fresh]).toMatchObject({ level: 3, depth: 1 });
  });

  it('starts an outline on a sheet that has none', () => {
    expect(insertSection('Some writing.', null, 'First part').text).toBe('Some writing.\n\n## First part\n');
    expect(insertSection('', null).text).toBe('## \n');
  });

  it('renames a heading without touching its writing', () => {
    const renamed = renameHeading(SHEET, 1, 'Eo sings');
    expect(titles(renamed)[1]).toBe('  A. Eo sings');
    expect(renamed).toContain('She sings.');
  });
});

describe('rearranging', () => {
  it('moves a section, and its writing goes with it', () => {
    const moved = moveSection(SHEET, 2, 'up');
    expect(titles(moved).slice(0, 3)).toEqual(['I. Intro', '  A. Darrow gets saved', '  B. Eo gets hung']);
    expect(moved).toContain('She sings.');
    expect(outlineOf(moved).find((h) => h.title === 'Eo gets hung')).toBeDefined();
  });

  it('moves a whole part, nested sections included', () => {
    const moved = moveSection(SHEET, 3, 'up');
    expect(titles(moved)).toEqual([
      'I. Becoming Gold',
      '  A. Darrow learns about the Institute',
      '  B. Darrow passes the test',
      'II. Intro',
      '  A. Eo gets hung',
      '  B. Darrow gets saved',
    ]);
  });

  it('won’t move a section out from under its parent', () => {
    expect(moveSection(SHEET, 1, 'up')).toBe(SHEET);
    expect(moveSection(SHEET, 5, 'down')).toBe(SHEET);
  });

  it('indents a section under the one above, and back out again', () => {
    const indented = changeLevel(SHEET, 3, 1);
    expect(titles(indented)).toEqual([
      'I. Intro',
      '  A. Eo gets hung',
      '  B. Darrow gets saved',
      '  C. Becoming Gold',
      '    1. Darrow learns about the Institute',
      '    2. Darrow passes the test',
    ]);
    expect(changeLevel(indented, 3, -1)).toBe(SHEET);
  });

  it('won’t outdent the top level into the sheet’s title', () => {
    expect(changeLevel(SHEET, 0, -1)).toBe(SHEET);
  });
});

describe('taking a section out', () => {
  it('removes the heading and its writing, and hands them back', () => {
    const { text, removed } = removeSection(SHEET, 1);
    expect(titles(text)).toEqual(['I. Intro', '  A. Darrow gets saved', 'II. Becoming Gold', '  A. Darrow learns about the Institute', '  B. Darrow passes the test']);
    expect(removed).toBe('### Eo gets hung\n\nShe sings.');
    expect(text).not.toContain('She sings.');
  });

  it('takes nested sections with it', () => {
    const { text, removed } = removeSection(SHEET, 0);
    expect(titles(text)).toEqual(['I. Becoming Gold', '  A. Darrow learns about the Institute', '  B. Darrow passes the test']);
    expect(removed).toContain('Eo gets hung');
  });

  it('leaves an empty sheet empty', () => {
    expect(removeSection('## Only\n', 0).text).toBe('');
  });
});
