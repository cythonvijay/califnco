import { getDocs, type Query } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { DB_CHANGE_EVENT, RepoError, type AccessErrorKind } from '../lib/api';

export function useQuery<T>(make: (() => Query | null) | null, deps: unknown[]) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AccessErrorKind | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const q = make?.() ?? null;
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    let off = false;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    getDocs(q)
      .then((s) => {
        if (!off) setData(s.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
      })
      .catch((e) => {
        if (off) return;
        const code = (e as { code?: string })?.code ?? '';
        if (code === 'permission-denied') {
          setErrorKind('unauthorized');
          setError('Access restricted by security policy. Verify that your account has the required role claim.');
        } else {
          setErrorKind('network_error');
          setError('Could not load records from the database. Check your connection and retry.');
        }
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, errorKind, reload };
}

/**
 * Hook for querying repository functions with accurate distinction between:
 * signed_out, unauthorized, missing_config, network_error, and empty data states.
 */
export function useRepoQuery<T>(fn: () => Promise<T[]>, deps: unknown[]) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AccessErrorKind | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let off = false;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    fn()
      .then((res) => {
        if (!off) setData(res);
      })
      .catch((e) => {
        if (off) return;
        if (e instanceof RepoError) {
          setErrorKind(e.kind);
          setError(e.message);
        } else {
          const code = (e as { code?: string })?.code ?? '';
          if (code === 'permission-denied') {
            setErrorKind('unauthorized');
            setError('Access denied by database rules. Ensure your account has the required role assigned.');
          } else {
            setErrorKind('network_error');
            setError((e as Error)?.message ?? 'Could not load data from the server.');
          }
        }
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    const onDb = () => reload();
    window.addEventListener(DB_CHANGE_EVENT, onDb);
    window.addEventListener('storage', onDb);
    return () => {
      window.removeEventListener(DB_CHANGE_EVENT, onDb);
      window.removeEventListener('storage', onDb);
    };
  }, [reload]);

  return { data, loading, error, errorKind, reload };
}
