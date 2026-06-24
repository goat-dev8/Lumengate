import { ShieldCheck, Sparkles, Wallet } from 'lucide-react';

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect your account',
    body: 'Link Freighter or another Stellar wallet. Your wallet signs settlements today.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify eligibility privately',
    body: 'Get a passport and confirm you are allowed without revealing personal details.',
  },
  {
    icon: Sparkles,
    title: 'Invest or send with confidence',
    body: 'Each passport supports one compliant settlement, with an audit-ready receipt afterward.',
  },
];

export function HowItWorks() {
  return (
    <section className="rounded-2xl border border-[#e3e8ee] bg-white p-6 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">How it works</p>
      <h2 className="mt-1 text-xl font-semibold text-[#012b54]">Private investing in three steps</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="rounded-xl bg-[#f6f9fc] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#007dfc]/10 text-sm font-semibold text-[#007dfc]">
                  {index + 1}
                </span>
                <Icon className="h-4 w-4 text-[#007dfc]" />
              </div>
              <h3 className="mt-3 font-semibold text-[#012b54]">{step.title}</h3>
              <p className="mt-2 text-sm text-[#475569]">{step.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
