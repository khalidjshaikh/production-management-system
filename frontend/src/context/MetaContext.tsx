import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from '../hooks/useApi';
import type { MetaResponse } from '../api/types';

interface MetaContextValue {
  meta: MetaResponse | undefined;
  loading: boolean;
  error: Error | undefined;
  refresh: () => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const state = useApi<MetaResponse>('/meta');
  return (
    <MetaContext.Provider
      value={{ meta: state.data, loading: state.loading, error: state.error, refresh: state.refresh }}
    >
      {children}
    </MetaContext.Provider>
  );
}

export function useMeta(): MetaContextValue {
  const context = useContext(MetaContext);
  if (!context) {
    throw new Error('useMeta must be used inside a MetaProvider');
  }
  return context;
}
