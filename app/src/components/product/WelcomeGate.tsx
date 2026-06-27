import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { loadPasskeySession } from '../../lib/passkeySession';

function WelcomeLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--lg-background)]">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#007dfc] border-t-transparent" />
        <p className="mt-4 text-sm text-[#64748b]">Restoring your session…</p>
      </div>
    </div>
  );
}

/** Skip welcome when a passkey session or smart account already exists. */
export function WelcomeGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { settlementAddress, signInWithPasskey } = useApp();
  const [ready, setReady] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (settlementAddress) {
      navigate('/app/home', { replace: true });
      return;
    }

    const saved = loadPasskeySession();
    if (!saved?.smartAccountAddress) {
      setReady(true);
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await signInWithPasskey();
        navigate('/app/home', { replace: true });
      } catch {
        setReady(true);
      }
    })();
  }, [settlementAddress, navigate, signInWithPasskey]);

  if (settlementAddress || !ready) {
    return <WelcomeLoading />;
  }

  return children;
}
