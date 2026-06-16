import { cn } from '../../lib/utils';

export function FinLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('fin-label', className)}>
      {children}
    </label>
  );
}

export function FinInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('fin-input', className)} {...props} />;
}

export function FinTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('fin-textarea', className)} {...props} />;
}
