import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { readAdvancedMode, writeAdvancedMode } from '../../lib/advancedMode';

type Props = {
  className?: string;
};

export function AdvancedModeToggle({ className }: Props) {
  const [enabled, setEnabled] = useState(() => readAdvancedMode());

  useEffect(() => {
    writeAdvancedMode(enabled);
    window.dispatchEvent(new CustomEvent('lumengate-advanced-mode', { detail: enabled }));
  }, [enabled]);

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-muted ${className ?? ''}`}
    >
      <Code2 className="h-3.5 w-3.5" />
      <span>Developer mode</span>
      <input
        type="checkbox"
        className="h-3.5 w-3.5 rounded border-slate-300"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
      />
    </label>
  );
}

export function useAdvancedMode(): boolean {
  const [enabled, setEnabled] = useState(() => readAdvancedMode());

  useEffect(() => {
    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setEnabled(detail);
      else setEnabled(readAdvancedMode());
    };
    window.addEventListener('lumengate-advanced-mode', onChange);
    return () => window.removeEventListener('lumengate-advanced-mode', onChange);
  }, []);

  return enabled;
}
