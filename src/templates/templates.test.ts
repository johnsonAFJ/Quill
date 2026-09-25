import { describe, expect, it } from 'vitest';
import { fillIn, isTemplate } from './templates';

const DAY = new Date(2026, 8, 25, 21, 14);

describe('filling in a template', () => {
  it('puts the sheet’s name and the date in', () => {
    expect(fillIn('# {{title}}\n\nWritten {{date}} at {{time}}.', { title: 'Echo', date: DAY })).toBe('# Echo\n\nWritten Friday, September 25, 2026 at 9:14 PM.');
  });

  it('handles the short date and stray spacing', () => {
    expect(fillIn('{{ day }}', { date: DAY })).toBe('2026-09-25');
  });

  it('leaves anything it doesn’t know alone', () => {
    expect(fillIn('{{character}} said {{title}}', { title: 'hello' })).toBe('{{character}} said hello');
  });

  it('knows which files are templates', () => {
    expect(isTemplate('/Templates/Scene.md')).toBe(true);
    expect(isTemplate('/templates/Scene.md')).toBe(true);
    expect(isTemplate('/Essays/Scene.md')).toBe(false);
    expect(isTemplate('/Templates')).toBe(false);
  });
});
