import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
        }
        return;
      }

      for (const s of shortcuts) {
        const ctrlOrMeta = s.ctrl || s.meta;
        if (ctrlOrMeta && !e.ctrlKey && !e.metaKey) continue;
        if (!ctrlOrMeta && (e.ctrlKey || e.metaKey)) continue;
        if (e.key.toLowerCase() === s.key.toLowerCase() && !e.repeat) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
