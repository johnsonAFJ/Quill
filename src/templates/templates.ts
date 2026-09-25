// Template sheets: a "Templates" group in your Quill folder. Every sheet in it
// is a starting point, offered when you make a new sheet. They're ordinary
// sheets, so you write and edit them exactly like anything else.
//
// A template can hold fill-ins, swapped in when the new sheet is made:
//   {{title}}  what you named the sheet      {{date}}  Thursday, September 25, 2026
//   {{day}}    2026-09-25                    {{time}}  9:14 PM

export const TEMPLATES_FOLDER = 'Templates';
export const TEMPLATES_PATH = `/${TEMPLATES_FOLDER}`;

export const STARTER_TEMPLATE = `# {{title}}

<!-- Written {{date}}. Anything in a comment like this is yours alone: it isn't counted as words and never shows in an export. -->

`;

export type FillIns = { title?: string; date?: Date };

export function fillIn(text: string, { title = '', date = new Date() }: FillIns = {}): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const values: Record<string, string> = {
    title,
    date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
  return text.replace(/\{\{\s*(title|date|day|time)\s*\}\}/g, (whole, name: string) => values[name] ?? whole);
}

/** Templates are offered by name; the folder itself is never a template. */
export function isTemplate(path: string): boolean {
  return path.toLowerCase().startsWith(TEMPLATES_PATH.toLowerCase() + '/') && path.toLowerCase().endsWith('.md');
}
