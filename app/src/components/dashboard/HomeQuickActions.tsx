import { Link } from 'react-router-dom';
import { ArrowRight, FileCheck2, Send, ShieldCheck, Store } from 'lucide-react';
import { Stagger, StaggerItem } from '../design/Primitives';
import type { ProductReadiness } from '../../lib/productState';

type Props = {
  readiness: ProductReadiness;
  readyToInvest: boolean;
  passportDesc: string;
  marketplaceDesc: string;
  receiptsDesc: string;
  sendDesc: string;
};

export function HomeQuickActions({
  readiness,
  readyToInvest,
  passportDesc,
  marketplaceDesc,
  receiptsDesc,
  sendDesc,
}: Props) {
  const actions = readyToInvest
    ? [
        {
          icon: Store,
          label: 'Browse marketplace',
          desc: marketplaceDesc,
          to: '/app/marketplace',
          cta: 'Explore investments',
          primary: true,
        },
        {
          icon: Send,
          label: 'Send privately',
          desc: sendDesc,
          to: '/app/send',
          cta: 'Open Send',
          primary: false,
        },
        {
          icon: ShieldCheck,
          label: 'Passport',
          desc: passportDesc,
          to: '/app/verify',
          cta: 'View passport',
          primary: false,
        },
        {
          icon: FileCheck2,
          label: 'Receipts',
          desc: receiptsDesc,
          to: '/app/compliance',
          cta: 'View receipts',
          primary: false,
        },
      ]
    : [
        {
          icon: ShieldCheck,
          label: 'Continue verification',
          desc: readiness.description,
          to: readiness.href,
          cta: readiness.cta,
          primary: true,
        },
        {
          icon: Store,
          label: 'Browse marketplace',
          desc: marketplaceDesc,
          to: '/app/marketplace',
          cta: 'Preview offerings',
          primary: false,
        },
        {
          icon: Send,
          label: 'Send privately',
          desc: sendDesc,
          to: '/app/send',
          cta: 'Open Send',
          primary: false,
        },
        {
          icon: FileCheck2,
          label: 'Receipts',
          desc: receiptsDesc,
          to: '/app/compliance',
          cta: 'View receipts',
          primary: false,
        },
      ];

  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ icon: Icon, label, desc, to, cta, primary }) => (
        <StaggerItem key={label}>
          <Link
            to={to}
            className={`group flex h-full flex-col rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${
              primary
                ? 'border-[#007dfc]/25 bg-gradient-to-br from-[#007dfc]/10 via-white to-white shadow-[0_12px_40px_rgba(0,125,252,0.12)] hover:shadow-[0_16px_48px_rgba(0,125,252,0.18)]'
                : 'border-[var(--lg-border)] bg-white/80 backdrop-blur-sm hover:border-[#007dfc]/20 hover:shadow-md'
            }`}
          >
            <div
              className={`grid h-11 w-11 place-items-center rounded-xl ${
                primary ? 'bg-[#007dfc] text-white' : 'bg-[var(--lg-muted-bg)] text-[#012b54]'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold text-[#012b54]">{label}</p>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-[#64748b]">{desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#007dfc]">
              {cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
