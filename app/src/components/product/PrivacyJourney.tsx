import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';

const PRIVATE = [
  'Name, date of birth, and jurisdiction',
  'Sanctions screening results',
  'Personal account details',
];

const DISCLOSED = [
  'Eligibility was satisfied at settlement',
  'Passport was used once',
  'Settlement reference for audit',
];

export function PrivacyJourney({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-5 lg:grid-cols-2'}>
      <Card className="border-emerald-100 bg-emerald-50/40">
        <CardHeader
          title="What stays private"
          badge={
            <Badge tone="ok">
              <EyeOff className="mr-1 inline h-3 w-3" />
              Private
            </Badge>
          }
        />
        <ul className="space-y-2 text-sm text-slate-muted">
          {PRIVATE.map((item) => (
            <li key={item} className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="What auditors can verify"
          badge={
            <Badge>
              <Eye className="mr-1 inline h-3 w-3" />
              Disclosure
            </Badge>
          }
        />
        <ul className="space-y-2 text-sm text-slate-muted">
          {DISCLOSED.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
