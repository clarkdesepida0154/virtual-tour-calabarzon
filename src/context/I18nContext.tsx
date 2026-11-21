import { createContext, use, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { Category, Province } from '@/constants/taxonomy';
import { usePreferences } from '@/context/PreferencesContext';
import { CATEGORY_KEYS, DATE_LOCALES, createTranslator } from '@/i18n';
import type { TFunction } from '@/i18n';
import type { AppError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { formatDistanceValue } from '@/lib/geo';
import type { Locale } from '@/lib/preferences';

type I18nValue = {
  locale: Locale;
  t: TFunction;
  /** "Historical Site" → its label in the current language. */
  categoryLabel: (category: Category, form?: 'label' | 'short' | 'blurb') => string;
  provinceTagline: (province: Province) => string;
  /** The plain-language message for an AppError, in the current language. */
  errorMessage: (error: AppError) => string;
  errorTitle: (error: AppError) => string;
  /** "17 November 2026" / "17 Nobyembre 2026". */
  date: (value: string | null | undefined) => string;
  /** "12.4 km away" / "12.4 km ang layo"; '' for an invalid distance. */
  distance: (km: number) => string;
  /** "12.4 km" / "Under 50 m away" — the distance without "away". */
  distanceValue: (km: number) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The UI language (Settings → Language). Switching re-renders every screen
 * at once; no restart. Destination content stays English by design.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const locale = preferences.locale;

  const value = useMemo<I18nValue>(() => {
    const t = createTranslator(locale);
    return {
      locale,
      t,
      categoryLabel: (category, form = 'label') => t(`categories.${CATEGORY_KEYS[category]}.${form}`),
      provinceTagline: (province) => t(`provinces.taglines.${province}`),
      errorMessage: (error) => {
        const context = t(error.contextKey, error.params);
        const suffix = t(`errors.suffix.${error.kind}`);
        return suffix ? `${context} ${suffix}` : context;
      },
      errorTitle: (error) => t(`errors.titles.${error.kind}`),
      date: (value) => formatDate(value, DATE_LOCALES[locale]),
      distance: (km) => {
        const value = formatDistanceValue(km);
        if (value === null) return '';
        return value === 'under-50' ? t('nearMe.under50') : t('nearMe.away', { distance: value });
      },
      distanceValue: (km) => {
        const value = formatDistanceValue(km);
        if (value === null) return '';
        return value === 'under-50' ? t('nearMe.under50') : value;
      },
    };
  }, [locale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>.');
  return value;
}
