// Quick capture (⌘⇧J): jotted thoughts go to the bottom of one "Quick Notes"
// sheet in the Inbox, each under the date and time, to sort out later.

export const QUICK_NOTES_PATH = '/Quick Notes.md';

/** "Mon, Sep 22 · 9:14 PM" */
function stamp(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** The sheet's new text with `note` added at the bottom. Nothing already there changes. */
export function appendQuickNote(existing: string | undefined, note: string, date: Date): string {
  const entry = `**${stamp(date)}**\n${note.trim()}\n`;
  if (!existing?.trim()) return `# Quick Notes\n\n${entry}`;
  return `${existing.replace(/\s*$/, '')}\n\n${entry}`;
}
