import { describe, expect, it } from 'vitest';
import { PROMPT_BATCHES } from './starter';
import { markUsed, mergeBatches, newPromptFile, pickPrompt, promptComment, promptParts, unusedPrompts, usedCount } from './prompts';

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

describe('picking', () => {
  it('hands out prompts with direction first, then the plain ones', () => {
    const file = '- Plain one\n- **Titled** — Do this. Vibe: calm. Anchor: one room. Aim: stillness.\n- Plain two\n';
    expect(pickPrompt(file, () => 0.99)?.text).toMatch(/^\*\*Titled/);
    const rest = markUsed(file, pickPrompt(file)!, DAY);
    expect(pickPrompt(rest, () => 0)?.text).toBe('Plain one');
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

describe('prompts with direction', () => {
  const RICH = '**The Wrong Recording** — Write a short vignette about a tape left in a secondhand car. Vibe: quiet dread. Anchor: only what you can hear. Aim: the reader leans closer.';

  it('splits out the title and the Vibe, Anchor and Aim lines', () => {
    expect(promptParts(RICH)).toEqual({
      title: 'The Wrong Recording',
      body: 'Write a short vignette about a tape left in a secondhand car.',
      details: [
        { label: 'Vibe', text: 'quiet dread.' },
        { label: 'Anchor', text: 'only what you can hear.' },
        { label: 'Aim', text: 'the reader leans closer.' },
      ],
    });
  });

  it('leaves a plain prompt as it is', () => {
    expect(promptParts('Describe a lighthouse.')).toEqual({ title: null, body: 'Describe a lighthouse.', details: [] });
  });

  it('writes it into the sheet as a comment, one part per line', () => {
    expect(promptComment(RICH)).toBe(
      '<!--\nPrompt: The Wrong Recording\nWrite a short vignette about a tape left in a secondhand car.\nVibe: quiet dread.\nAnchor: only what you can hear.\nAim: the reader leans closer.\n-->\n\n',
    );
  });
});

describe('Quill’s own prompts', () => {
  it('gives every prompt in batch 2 a title and Vibe, Anchor and Aim lines', () => {
    const incomplete = PROMPT_BATCHES[1]!.filter((p) => {
      const parts = promptParts(p);
      return !parts.title || parts.details.map((d) => d.label).join() !== 'Vibe,Anchor,Aim';
    });
    expect(incomplete).toEqual([]);
  });
});
