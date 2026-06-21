import { cn } from '../../lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const variants = {
    primary:
      'bg-[#007dfc] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-[#012b54] hover:shadow-glow',
    secondary:
      'bg-white text-[#007dfc] border border-[#eef0f3] hover:border-[#007dfc] hover:bg-[#f0f6ff]',
    ghost: 'bg-transparent text-ink hover:bg-canvas-soft rounded-xl',
    white: 'bg-white text-ink shadow-card hover:shadow-glow rounded-xl',
  };
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : null}
      {children}
    </button>
  );
}
