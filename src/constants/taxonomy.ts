/**
 * The fixed vocabularies of the app: the five CALABARZON provinces and the
 * five destination categories. These mirror the CHECK constraints in
 * supabase/schema.sql — change both together.
 *
 * Keep this file free of React Native imports: scripts/verify-crud.mjs loads
 * it in plain Node through the repository layer.
 */
import type { IconName } from '@/components/AppIcon';

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

type CategoryMeta = {
  icon: IconName;
  /** Compact label for chips and tags. */
  shortLabel: string;
  /** One-line explanation shown on the Home category tiles. */
  blurb: string;
};

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  'Historical Site': {
    icon: 'bank-outline',
    shortLabel: 'Historical',
    blurb: 'Shrines and landmarks of the nation’s story',
  },
  'Church & Religious': {
    icon: 'church-outline',
    shortLabel: 'Churches',
    blurb: 'Centuries-old churches and places of faith',
  },
  'Museum & Art': {
    icon: 'palette-outline',
    shortLabel: 'Museums & Art',
    blurb: 'Galleries, collections and ancient art',
  },
  'Natural Wonder': {
    icon: 'waterfall',
    shortLabel: 'Nature',
    blurb: 'Falls, lakes, volcanoes and mountains',
  },
  'Heritage Town & Culture': {
    icon: 'home-group',
    shortLabel: 'Heritage & Culture',
    blurb: 'Old towns, traditions and living culture',
  },
};

type ProvinceMeta = {
  /** Short identity line shown on the Home province list. */
  tagline: string;
};

export const PROVINCE_META: Record<Province, ProvinceMeta> = {
  Cavite: { tagline: 'Cradle of the Philippine Revolution' },
  Laguna: { tagline: 'Birthplace of José Rizal' },
  Batangas: { tagline: 'Taal Volcano and its heritage towns' },
  Rizal: { tagline: 'Home of Angono, the art capital' },
  Quezon: { tagline: 'Coconut country and colourful fiestas' },
};

export function isProvince(value: unknown): value is Province {
  return typeof value === 'string' && (PROVINCES as readonly string[]).includes(value);
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}
