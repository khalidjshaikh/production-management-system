import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export interface ApiState<T> {
  data: T | undefined;
  loading: boolean;
  refreshing: boolean;
  error: Error | undefined;
  refresh: () => void;
}

export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    if (hasData.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(undefined);

    api.get<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        hasData.current = true;
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [path, version]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  return { data, loading, refreshing, error, refresh };
}

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
