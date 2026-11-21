/**
 * The fixed vocabularies of the app: the five CALABARZON provinces and the
 * five destination categories. These mirror the CHECK constraints in
 * supabase/schema.sql — change both together.
 *
 * Keep this file free of React Native imports: scripts/verify-crud.mjs loads
 * it in plain Node through the repository layer.
 */
import type { IconName } from '@/components/AppIcon';
import type { ColorToken } from '@/theme';

export const PROVINCES = ['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon'] as const;
export type Province = (typeof PROVINCES)[number];

export const CATEGORIES = [
  'Historical Site',
  'Church & Religious',
  'Museum & Art',
  'Natural Wonder',
  'Heritage Town & Culture',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const REGION_NAME = 'CALABARZON';
export const REGION_LABEL = 'Region IV-A · CALABARZON';

/**
 * Icon and colour of each category. Its labels ("Historical", the Home tile
 * blurb) live in the i18n dictionaries (`categories.<key>`), so they follow
 * the UI language; the category values themselves stay English in the
 * database.
 */
type CategoryMeta = {
  icon: IconName;
  /** Colour of this category's map pins and legend chip. */
  color: ColorToken;
};

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  'Historical Site': {
    icon: 'bank-outline',
    color: 'categoryHistorical',
  },
  'Church & Religious': {
    icon: 'church-outline',
    color: 'categoryChurch',
  },
  'Museum & Art': {
    icon: 'palette-outline',
    color: 'categoryMuseum',
  },
  'Natural Wonder': {
    icon: 'waterfall',
    color: 'categoryNature',
  },
  'Heritage Town & Culture': {
    icon: 'home-group',
    color: 'categoryHeritage',
  },
};

export function isProvince(value: unknown): value is Province {
  return typeof value === 'string' && (PROVINCES as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}
