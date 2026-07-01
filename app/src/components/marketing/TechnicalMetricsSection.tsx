import { motion } from 'framer-motion';
import { Boxes, Component, FileStack, Route, CheckCircle2, Cpu } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const STATS = [
  { value: '19', label: 'Soroban contract crates', icon: Boxes, color: '#007dfc' },
  { value: '93', label: 'React components', icon: Component, color: '#6366f1' },
  { value: '13', label: 'Frontend route pages', icon: FileStack, color: '#c9f31d' },
  { value: '21', label: 'Issuer API routes', icon: Route, color: '#007dfc' },
  { value: '219', label: 'Passing tests, 0 failures', icon: CheckCircle2, color: '#10b981' },
  { value: '2', label: 'Noir circuits, UltraHonk verified', icon: Cpu, color: '#6366f1' },
];

export function TechnicalMetricsSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className="lg-metric-card"
            >
              <span
                className="lg-metric-icon"
                style={{ background: `linear-gradient(135deg, ${stat.color}, ${stat.color}99)` }}
              >
                <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
              </span>
              <div className="lg-metric-value" style={{ backgroundImage: `linear-gradient(135deg, #012b54, ${stat.color})` }}>
                {stat.value}
              </div>
              <div className="lg-metric-label">{stat.label}</div>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-[#94a3b8]">
        Recomputed from source and reconfirmed by running the full test suite — see the Test Coverage section of the
        project README for the exact reproduction commands.
      </p>
    </div>
  );
}
