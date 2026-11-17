/**
 * Pure logic behind the shared Add/Edit form: its value shape, validation,
 * and the conversion to a database row. No React and no React Native here,
 * so scripts/verify-crud.mjs can exercise it under Node.
 */
import type { Category, Province } from '@/constants/taxonomy';
import type { Destination, DestinationInsert } from '@/types/database';

/** Everything the user types is kept as text until it is saved. */
export type DestinationFormValues = {
  name: string;
  description: string;
  address: string;
  municipality: string;
  province: Province | null;
  category: Category | null;
  latitude: string;
  longitude: string;
  history: string;
  culturalSignificance: string;
};

export type DestinationFormField = keyof DestinationFormValues;
export type DestinationFormErrors = Partial<Record<DestinationFormField, string>>;

export const FIELD_LIMITS = {
  name: 120,
  municipality: 80,
  address: 240,
  description: 1200,
  longText: 2400,
} as const;

/** The order fields appear on screen — used to jump to the first error. */
export const FORM_FIELD_ORDER: readonly DestinationFormField[] = [
  'name',
  'category',
  'province',
  'municipality',
  'address',
  'description',
  'latitude',
  'longitude',
  'history',
  'culturalSignificance',
];

export const EMPTY_FORM_VALUES: DestinationFormValues = {
  name: '',
  description: '',
  address: '',
  municipality: '',
  province: null,
  category: null,
  latitude: '',
  longitude: '',
  history: '',
  culturalSignificance: '',
};

export function valuesFromDestination(destination: Destination): DestinationFormValues {
  return {
    name: destination.name,
    description: destination.description,
    address: destination.address,
    municipality: destination.municipality ?? '',
    province: destination.province,
    category: destination.category,
    latitude: destination.latitude === null ? '' : String(destination.latitude),
    longitude: destination.longitude === null ? '' : String(destination.longitude),
    history: destination.history ?? '',
    culturalSignificance: destination.cultural_significance ?? '',
  };
}

/** Accepts "14.2136", " 14,2136 " and "-14.2"; returns `null` for anything else. */
export function parseCoordinate(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function validateCoordinate(
  text: string,
  other: string,
  label: 'Latitude' | 'Longitude',
  limit: number,
): string | undefined {
  const hasValue = text.trim().length > 0;
  const otherHasValue = other.trim().length > 0;

  if (!hasValue) {
    return otherHasValue ? `Add the ${label.toLowerCase()} too, or clear both.` : undefined;
  }
  const value = parseCoordinate(text);
  if (value === null) return `${label} must be a number, like ${label === 'Latitude' ? '14.2136' : '121.1669'}.`;
  if (Math.abs(value) > limit) return `${label} must be between -${limit} and ${limit}.`;
  return undefined;
}

export function validateDestinationForm(values: DestinationFormValues): DestinationFormErrors {
  const errors: DestinationFormErrors = {};

  if (!values.name.trim()) errors.name = 'Give the destination a name.';
  if (!values.category) errors.category = 'Choose a category.';
  if (!values.province) errors.province = 'Choose a province.';
  if (!values.address.trim()) errors.address = 'Add the address.';
  if (!values.description.trim()) errors.description = 'Write a short description.';

  const latitude = validateCoordinate(values.latitude, values.longitude, 'Latitude', 90);
  if (latitude) errors.latitude = latitude;
  const longitude = validateCoordinate(values.longitude, values.latitude, 'Longitude', 180);
  if (longitude) errors.longitude = longitude;

  return errors;
}

export function firstInvalidField(errors: DestinationFormErrors): DestinationFormField | null {
  return FORM_FIELD_ORDER.find((field) => errors[field]) ?? null;
}

function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Converts validated form values into a row for Supabase. Call
 * `validateDestinationForm` first — this throws if a required choice is missing.
 */
export function toDestinationInput(
  values: DestinationFormValues,
  coverImageUrl: string | null,
): DestinationInsert {
  if (!values.province || !values.category) {
    throw new Error('Province and category are required.');
  }
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    address: values.address.trim(),
    municipality: textOrNull(values.municipality),
    province: values.province,
    category: values.category,
    latitude: parseCoordinate(values.latitude),
    longitude: parseCoordinate(values.longitude),
    history: textOrNull(values.history),
    cultural_significance: textOrNull(values.culturalSignificance),
    cover_image_url: coverImageUrl,
  };
}
