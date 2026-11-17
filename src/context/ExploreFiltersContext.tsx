import { createContext, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Category, Province } from '@/constants/taxonomy';

export type ExploreFilters = {
  query: string;
  category: Category | null;
  province: Province | null;
};

type ExploreFiltersValue = {
  filters: ExploreFilters;
  activeCount: number;
  setQuery: (query: string) => void;
  /** Selects the category, or clears it when it is already selected. */
  toggleCategory: (category: Category) => void;
  /** Selects the province, or clears it when it is already selected. */
  toggleProvince: (province: Province) => void;
  /** Replaces all filters at once — used by the Home shortcuts. */
  applyFilters: (next: Partial<ExploreFilters>) => void;
  clearFilters: () => void;
};

const NO_FILTERS: ExploreFilters = { query: '', category: null, province: null };

const ExploreFiltersContext = createContext<ExploreFiltersValue | null>(null);

/**
 * Holds the Explore screen's search text and filters above the tab navigator,
 * so Home can pre-fill them ("show me churches") before switching tabs.
 */
export function ExploreFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<ExploreFilters>(NO_FILTERS);

  const setQuery = useCallback(
    (query: string) => setFilters((current) => ({ ...current, query })),
    [],
  );
  const toggleCategory = useCallback(
    (category: Category) =>
      setFilters((current) => ({
        ...current,
        category: current.category === category ? null : category,
      })),
    [],
  );
  const toggleProvince = useCallback(
    (province: Province) =>
      setFilters((current) => ({
        ...current,
        province: current.province === province ? null : province,
      })),
    [],
  );
  const applyFilters = useCallback(
    (next: Partial<ExploreFilters>) => setFilters({ ...NO_FILTERS, ...next }),
    [],
  );
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), []);

  const value = useMemo<ExploreFiltersValue>(() => {
    const activeCount =
      (filters.query.trim() ? 1 : 0) + (filters.category ? 1 : 0) + (filters.province ? 1 : 0);
    return {
      filters,
      activeCount,
      setQuery,
      toggleCategory,
      toggleProvince,
      applyFilters,
      clearFilters,
    };
  }, [filters, setQuery, toggleCategory, toggleProvince, applyFilters, clearFilters]);

  return <ExploreFiltersContext value={value}>{children}</ExploreFiltersContext>;
}

export function useExploreFilters(): ExploreFiltersValue {
  const value = use(ExploreFiltersContext);
  if (!value) throw new Error('useExploreFilters must be used inside <ExploreFiltersProvider>.');
  return value;
}
