// Facts about the device Quill is running on, and small per-device settings.

/** Used in conflict copy names, e.g. "Story (conflict, iPhone, Sep 21).md". */
export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  // iPads report themselves as Macs; a touch screen gives them away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Browser';
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;

export const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Per-device preferences (theme, sort order, last open sheet). Never writing. */
export const prefs = {
  get<T>(name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem('quill.' + name);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(name: string, value: unknown): void {
    try {
      localStorage.setItem('quill.' + name, JSON.stringify(value));
    } catch {
      // Private browsing or full storage: preferences just don't stick.
    }
  },
};

export type Theme = 'auto' | 'light' | 'dark';

export function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
