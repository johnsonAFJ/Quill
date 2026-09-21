// Pop-up menus and the small "name this" dialog.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export type MenuItem = { label: string; icon?: IconName; checked?: boolean; danger?: boolean; onSelect: () => void } | 'divider';

/** A "•••" button that opens a menu of actions. */
export function MenuButton({ items, label = 'More' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="icon-button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={i} className="menu-divider" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                className={item.danger ? 'danger' : undefined}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.checked !== undefined ? <span className="check">{item.checked ? '✓' : ''}</span> : item.icon && <Icon name={item.icon} size={18} />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return (
    <div className="backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export type NameRequest = { title: string; initial: string; action: string; onDone: (name: string) => void };

export function NameDialog({ request, onClose }: { request: NameRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.initial);
  const submit = () => {
    if (value.trim()) request.onDone(value.trim());
    onClose();
  };
  return (
    <Dialog title={request.title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} />
        <div className="dialog-actions">
          <button type="button" className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!value.trim()}>
            {request.action}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
