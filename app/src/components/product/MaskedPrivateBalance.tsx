import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';

type Props = {
  label?: string;
  revealedValue: string;
  className?: string;
};

/** Privacy-first balance row with blur reveal animation. */
export function MaskedPrivateBalance({
  label = 'Available balance',
  revealedValue,
  className,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={className ?? 'mt-5 flex items-center justify-between rounded-xl bg-[#f6f9fc] px-4 py-3'}>
      <span className="text-sm text-[#64748b]">{label}</span>
      <div className="flex items-center gap-2">
        <motion.span
          key={revealed ? 'open' : 'closed'}
          initial={{ opacity: 0, filter: 'blur(5px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-base font-semibold tabular-nums text-[#012b54]"
        >
          {revealed ? revealedValue : '••••••'}
        </motion.span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide private balance' : 'Reveal private balance'}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
