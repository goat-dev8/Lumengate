import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPassportScopeRows, type PassportScopeRow } from '../lib/passportScopeStatus';

export function usePassportScopeStatuses() {
  const { config, credential, proof } = useApp();
  const [rows, setRows] = useState<PassportScopeRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!credential) {
      setRows(null);
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return fetchPassportScopeRows(config, credential, proof)
      .then((next) => {
        setRows(next);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    if (!credential) {
      setRows(null);
      return;
    }
    setLoading(true);
    fetchPassportScopeRows(config, credential, proof)
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
