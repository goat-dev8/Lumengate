import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const STATS = [
  { value: '19', label: 'Soroban contract crates' },
  { value: '93', label: 'React components' },
  { value: '13', label: 'Frontend route pages' },
  { value: '21', label: 'Issuer API routes' },
  { value: '219', label: 'Passing tests, 0 failures' },
  { value: '2', label: 'Noir circuits, UltraHonk verified' },
];

export function TechnicalMetricsSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className="lg-card-reveal rounded-2xl border border-[#eef0f3] bg-white p-5 text-center"
            style={{ transitionDelay: visible ? `${i * 0.08}s` : '0s' }}
          >
            <div className="text-3xl font-semibold text-[#007dfc]">{stat.value}</div>
            <div className="mt-1 text-xs leading-snug text-[#64748b]">{stat.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-[#94a3b8]">
        Recomputed from source and reconfirmed by running the full test suite — see the Test Coverage section of the
        project README for the exact reproduction commands.
      </p>
    </div>
  );
}
