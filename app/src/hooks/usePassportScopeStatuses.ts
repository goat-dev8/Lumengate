import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPassportScopeRows, type PassportScopeRow } from '../lib/passportScopeStatus';

export function usePassportScopeStatuses() {
  const { config, credential, proof } = useApp();
  const [rows, setRows] = useState<PassportScopeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (!credential) {
      setRows(null);
      return Promise.resolve();
    }
    if (inFlightRef.current) return inFlightRef.current;

    const run = fetchPassportScopeRows(config, credential, proof)
      .then((next) => {
        setRows(next);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = null;
      });

    setLoading(true);
    setError(null);
    inFlightRef.current = run;
    return run;
  }, [
    config,
    credential?.credential?.root,
    credential?.issuedAt,
    proof?.publicInputsHex,
    proof?.publicInputs?.assetId,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!credential) {
      setRows(null);
      return;
    }
    setLoading(true);
    void fetchPassportScopeRows(config, credential, proof)
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    config,
    credential?.credential?.root,
    credential?.issuedAt,
    proof?.publicInputsHex,
    proof?.publicInputs?.assetId,
  ]);

  return { rows, loading, error, refresh };
}
