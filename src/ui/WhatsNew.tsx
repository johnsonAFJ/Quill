import type { ReactNode } from 'react';
import type { Update } from '../app/changelog';
import { Dialog } from './Overlays';

/** Turns **bold** and `code` in a changelog line into formatting. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}

export function WhatsNew({ updates, title = 'What’s new', onClose }: { updates: Update[]; title?: string; onClose: () => void }) {
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="whats-new">
        {updates.map((u) => (
          <section key={u.title}>
            <h3>{u.title}</h3>
            <ul>
              {u.items.map((item, i) => (
                <li key={i}>{inline(item)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="dialog-actions">
        <button onClick={onClose}>Got it</button>
      </div>
    </Dialog>
  );
}
