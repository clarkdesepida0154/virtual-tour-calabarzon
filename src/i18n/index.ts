/**
 * i18n entry point (pure — Node scripts and tests import it).
 *
 *   const { t } = useI18n();            // in components (src/context/I18nContext)
 *   t('explore.count', { count: 26 });  // "26 destinations" / "26 destinasyon"
 */
import type { Category } from '@/constants/taxonomy';
import { en } from '@/i18n/en';
import type { EnglishDictionary } from '@/i18n/en';
import { fil } from '@/i18n/fil';
import { translate } from '@/i18n/translate';
import type { KeysOf, TranslateParams } from '@/i18n/translate';
import type { Locale } from '@/lib/preferences';

export const DICTIONARIES: Record<Locale, unknown> = { en, fil };

export type TranslationKey = KeysOf<EnglishDictionary>;
export type TFunction = (key: TranslationKey, params?: TranslateParams) => string;

/** A translator for `locale`; missing strings fall back to English. */
export function createTranslator(locale: Locale): TFunction {
  const dictionary = DICTIONARIES[locale];
  return (key, params) => translate(dictionary, key, params, en);
}

/** English translator for pure modules (AppError messages, scripts). */
export const tEnglish: TFunction = createTranslator('en');

/** BCP 47 tag for dates and numbers. */
export const DATE_LOCALES: Record<Locale, string> = { en: 'en-PH', fil: 'fil-PH' };

/** Dictionary slug of each category (its values stay English in the database). */
export const CATEGORY_KEYS: Record<Category, 'historical' | 'church' | 'museum' | 'nature' | 'heritage'> = {
  'Historical Site': 'historical',
  'Church & Religious': 'church',
  'Museum & Art': 'museum',
  'Natural Wonder': 'nature',
  'Heritage Town & Culture': 'heritage',
};
