import { Dialog } from './Overlays';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Formatting',
    keys: [
      ['⌘B', 'Bold'],
      ['⌘I', 'Italic'],
      ['⌘1  ⌘2  ⌘3', 'Heading 1, 2, 3 (⌥⌘1, ⌥⌘2, ⌥⌘3 work too)'],
      ['⌘\'', 'Quote'],
      ['⌘⇧8', 'List'],
      ['⌘K', 'Link'],
      ['⌘/', 'Comment (not counted as words). Nothing selected: the whole paragraph'],
    ],
  },
  {
    title: 'Writing',
    keys: [
      ['⌘F', 'Find and replace in this sheet (Enter for the next one, Esc to close)'],
      ['⌘L', 'Select the paragraph (again for the next)'],
      ['⌘Z  ⌘⇧Z', 'Undo, redo'],
      ['⌘⇧F', 'Just the text (hide the sidebars)'],
      ['⌥⌘S', 'Start or end a sprint'],
      ['⌘⇧X', 'Set aside the selection (or this paragraph) in Cuts'],
      ['⌥⌘ [   ⌥⌘ ]', 'Option, Command and the [ key (right of P) folds the section you’re in down to its heading; with ] it opens again'],
    ],
  },
  {
    title: 'Anywhere in Quill',
    keys: [
      ['⌘⇧J', 'Quick note, added to “Quick Notes” in the Inbox'],
      ['⌥⌘N', 'New sheet in the Inbox'],
      ['⌥⌘F', 'Search everything (again, or Esc, to go back)'],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      {GROUPS.map((g) => (
        <section key={g.title} className="settings-section">
          <h3>{g.title}</h3>
          <dl className="shortcuts">
            {g.keys.map(([keys, what]) => (
              <div key={keys}>
                <dt>{keys}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className="dialog-actions">
        <button onClick={onClose}>Done</button>
      </div>
    </Dialog>
  );
}
