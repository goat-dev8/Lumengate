import { useEffect, useState } from 'react';
import { fetchOfferings, type LiveOffering } from '../lib/offerings';
import { loadDeploymentConfig } from '../lib/config';

export function useOfferings() {
  const config = loadDeploymentConfig();
  const [offerings, setOfferings] = useState<LiveOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOfferings(config.issuerServiceUrl)
      .then((rows) => {
        if (!cancelled) {
          setOfferings(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOfferings([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config.issuerServiceUrl]);

  return { offerings, loading, error, config };
}

export function useOffering(id: string | undefined) {
  const { offerings, loading, error, config } = useOfferings();
  const offering = id ? offerings.find((o) => o.id === id) : undefined;
  return { offering, offerings, loading, error, config };
}
