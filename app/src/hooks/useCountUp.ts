import { useEffect, useState } from 'react';

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function useCountUp(target: number, duration = 1400, pauseMs = 2200, loop = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let pauseTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const runCycle = () => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - start) / duration, 1);
        setValue(Math.round(target * easeOutCubic(progress)));
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        if (!loop) return;
        pauseTimer = setTimeout(() => {
          if (cancelled) return;
          setValue(0);
          runCycle();
        }, pauseMs);
      };
      frame = requestAnimationFrame(tick);
    };

    runCycle();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, [target, duration, pauseMs, loop]);

  return value;
}
