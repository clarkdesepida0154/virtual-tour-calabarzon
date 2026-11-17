import { createContext, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type DataSyncValue = {
  /** Increases every time a destination is added, edited or deleted. */
  version: number;
  /** Call after any write so every screen showing destinations reloads. */
  notifyChanged: () => void;
};

const DataSyncContext = createContext<DataSyncValue | null>(null);

/**
 * A deliberately tiny alternative to a global store: screens fetch their own
 * data, and this counter tells them when that data has gone stale.
 */
export function DataSyncProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((current) => current + 1), []);
  const value = useMemo(() => ({ version, notifyChanged }), [version, notifyChanged]);

  return <DataSyncContext value={value}>{children}</DataSyncContext>;
}

export function useDataSync(): DataSyncValue {
  const value = use(DataSyncContext);
  if (!value) throw new Error('useDataSync must be used inside <DataSyncProvider>.');
  return value;
}
