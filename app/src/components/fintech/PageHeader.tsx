import { Badge } from '../ui/Badge';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <Badge tone="brand" className="normal-case tracking-normal">
          {eyebrow}
        </Badge>
      ) : null}
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-navy lg:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-muted lg:text-base">{subtitle}</p> : null}
    </div>
  );
}
