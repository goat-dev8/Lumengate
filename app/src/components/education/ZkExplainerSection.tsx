import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export type CryptoTerm = {
  label: string;
  detail: string;
};

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  diagram: ReactNode;
  terms?: CryptoTerm[];
  defaultOpen?: boolean;
  className?: string;
};

export function ZkExplainerSection({
  id,
  eyebrow,
  title,
  summary,
  diagram,
  terms,
  defaultOpen = false,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        'zk-explainer-panel mt-10 overflow-hidden rounded-2xl border border-[var(--lg-border)] bg-[#f6f9fc]/60',
        className,
      )}
      aria-labelledby={`${id}-heading`}
    >
      <button
        type="button"
        id={`${id}-heading`}
        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition hover:bg-white/50 md:px-6"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold text-[#012b54] md:text-xl">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm text-[#64748b]">{summary}</p>
        </div>
        <ChevronDown
          className={cn('mt-1 h-5 w-5 shrink-0 text-[#64748b] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={`${id}-panel`} className="border-t border-[var(--lg-border)] bg-white px-5 py-6 md:px-6">
          <div className="flex justify-center py-2">{diagram}</div>
          {terms && terms.length > 0 ? (
            <dl className="zk-term-grid mt-6">
              {terms.map((term) => (
                <div key={term.label} className="zk-term-pill">
                  <dt>{term.label}</dt>
                  <dd>{term.detail}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
