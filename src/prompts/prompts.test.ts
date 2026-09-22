import { describe, expect, it } from 'vitest';
import { markUsed, mergeBatches, newPromptFile, pickPrompt, promptComment, unusedPrompts, usedCount } from './prompts';

const DAY = new Date('2026-09-22T23:30:00'); // late evening, local time

describe('reading the list', () => {
  const file = `# Prompts

Intro.

- A storm at sea
- [ ] A locked drawer
* A letter never sent

## Used
- [x] 2026-09-20 · An empty train station
`;
  it('finds unticked list items, with or without a checkbox', () => {
    expect(unusedPrompts(file).map((p) => p.text)).toEqual(['A storm at sea', 'A locked drawer', 'A letter never sent']);
    expect(usedCount(file)).toBe(1);
  });

  it('ticks a prompt off and moves it under Used with the date', () => {
    const drawer = unusedPrompts(file)[1]!;
    const next = markUsed(file, drawer, DAY);
    expect(unusedPrompts(next).map((p) => p.text)).toEqual(['A storm at sea', 'A letter never sent']);
    expect(next).toContain('## Used\n- [x] 2026-09-22 · A locked drawer\n- [x] 2026-09-20 · An empty train station');
    expect(next.startsWith('# Prompts\n\nIntro.\n\n- A storm at sea\n')).toBe(true);
  });

  it('adds a Used section when there isn’t one', () => {
    const next = markUsed('- One\n- Two\n', { text: 'One', line: 0 }, DAY);
    expect(next).toBe('- Two\n\n## Used\n- [x] 2026-09-22 · One\n');
  });

  it('leaves the file alone if the prompt moved in the meantime', () => {
    expect(markUsed('- One\n- Two\n', { text: 'Two', line: 0 }, DAY)).toBe('- One\n- Two\n');
  });

  it('never picks a used prompt', () => {
    const next = markUsed(file, unusedPrompts(file)[0]!, DAY);
    for (let r = 0; r < 1; r += 0.1) expect(pickPrompt(next, () => r)!.text).not.toBe('A storm at sea');
    expect(pickPrompt('## Used\n- [x] 2026-09-20 · Done\n')).toBeNull();
  });
});

describe('Quill’s own prompts', () => {
  const batches = [['A storm at sea', 'A locked drawer'], ['A letter never sent']];

  it('starts a new file with every batch', () => {
    const file = newPromptFile(batches.slice(0, 1));
    expect(file).toContain('Delete any you don\'t like.\n\n- A storm at sea\n- A locked drawer\n\n<!--');
    expect(unusedPrompts(file).map((p) => p.text)).toEqual(['A storm at sea', 'A locked drawer']);
    expect(file).toContain('<!-- Quill has added its prompt batches up to 1. -->');
  });

  it('adds only new batches, and never brings back prompts you deleted or used', () => {
    let file = newPromptFile(batches.slice(0, 1));
    file = markUsed(file, unusedPrompts(file)[0]!, DAY); // used "A storm at sea"
    file = file.replace('- A locked drawer\n', ''); // deleted "A locked drawer"
    const merged = mergeBatches(file, batches);
    expect(unusedPrompts(merged).map((p) => p.text)).toEqual(['A letter never sent']);
    expect(merged).toContain('<!-- Quill has added its prompt batches up to 2. -->');
    expect(mergeBatches(merged, batches)).toBe(merged);
  });

  it('leaves the rest of your file as you wrote it', () => {
    const file = '# Prompts\n\n\n\nMy own notes.\n\n- Mine\n\n<!-- Quill has added its prompt batches up to 1. -->\n';
    expect(mergeBatches(file, batches)).toBe('# Prompts\n\n\n\nMy own notes.\n\n- Mine\n- A letter never sent\n\n<!-- Quill has added its prompt batches up to 2. -->\n');
  });

  it('skips a new prompt you already added yourself', () => {
    const file = '- a letter never sent!\n\n<!-- Quill has added its prompt batches up to 1. -->\n';
    expect(unusedPrompts(mergeBatches(file, batches)).map((p) => p.text)).toEqual(['a letter never sent!']);
  });
});

describe('promptComment', () => {
  it('tucks the prompt into a comment so it isn’t counted', () => {
    expect(promptComment('Write about --> arrows')).toBe('<!-- Prompt: Write about —> arrows -->\n\n');
  });
});
