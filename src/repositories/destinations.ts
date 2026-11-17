/**
 * Destinations repository — every read and write of the `destinations` table.
 *
 * It is a factory that receives the Supabase client, so the exact same code
 * runs in the app (see ./index.ts) and in scripts/verify-crud.mjs under Node.
 * Keep it free of React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { CATEGORIES, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { AppError, toAppError } from '@/lib/errors';
import type {
  Database,
  Destination,
  DestinationInsert,
  DestinationUpdate,
} from '@/types/database';

const TABLE = 'destinations';

/** Postgres "invalid text representation" — e.g. an id that is not a UUID. */
const INVALID_INPUT_SYNTAX = '22P02';

export type DestinationFilters = {
  /** Matched against name and municipality (case-insensitive, partial). */
  search?: string;
  category?: Category | null;
  province?: Province | null;
};

export type DestinationCounts = {
  total: number;
  byCategory: Record<Category, number>;
  byProvince: Record<Province, number>;
};

/**
 * Builds the PostgREST `or` filter for search-as-you-type.
 *
 * The term is user input, so it is escaped twice: once for LIKE (so `%` and
 * `_` are searched literally) and once for PostgREST's filter grammar (the
 * value is double-quoted so commas, dots and parentheses cannot break it).
 */
export function buildSearchFilter(term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed) return null;

  const likePattern = `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const quoted = `"${likePattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;

  return `name.ilike.${quoted},municipality.ilike.${quoted}`;
}

function emptyCounts(): DestinationCounts {
  return {
    total: 0,
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
    byProvince: Object.fromEntries(PROVINCES.map((p) => [p, 0])) as Record<Province, number>,
  };
}

export function createDestinationsRepository(client: SupabaseClient<Database>) {
  /** All destinations matching the filters, A–Z. Filters combine with AND. */
  async function list(filters: DestinationFilters = {}): Promise<Destination[]> {
    let query = client.from(TABLE).select('*');

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.province) query = query.eq('province', filters.province);

    const search = buildSearchFilter(filters.search ?? '');
    if (search) query = query.or(search);

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw toAppError(error, 'We couldn’t load the destinations.');
    return data;
  }

  /** The newest destinations, for the Home carousel. */
  async function listFeatured(limit = 6): Promise<Destination[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw toAppError(error, 'We couldn’t load the featured destinations.');
    return data;
  }

  /** One destination, or `null` when it does not exist (or was deleted). */
  async function getById(id: string): Promise<Destination | null> {
    const { data, error } = await client.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) {
      if (error.code === INVALID_INPUT_SYNTAX) return null;
      throw toAppError(error, 'We couldn’t load this destination.');
    }
    return data;
  }

  async function create(input: DestinationInsert): Promise<Destination> {
    const { data, error } = await client.from(TABLE).insert(input).select().single();
    if (error) throw toAppError(error, 'We couldn’t save the destination.');
    return data;
  }

  async function update(id: string, changes: DestinationUpdate): Promise<Destination> {
    const { data, error } = await client
      .from(TABLE)
      .update(changes)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw toAppError(error, 'We couldn’t save your changes.');
    if (!data) {
      throw new AppError('not-found', 'This destination no longer exists, so it can’t be edited.');
    }
    return data;
  }

  async function remove(id: string): Promise<void> {
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) throw toAppError(error, 'We couldn’t delete the destination.');
  }

  /** How many destinations each category and province has (for Home). */
  async function counts(): Promise<DestinationCounts> {
    const { data, error } = await client.from(TABLE).select('category, province');
    if (error) throw toAppError(error, 'We couldn’t load the destination counts.');

    const result = emptyCounts();
    for (const row of data) {
      result.total += 1;
      if (row.category in result.byCategory) result.byCategory[row.category] += 1;
      if (row.province in result.byProvince) result.byProvince[row.province] += 1;
    }
    return result;
  }

  return { list, listFeatured, getById, create, update, remove, counts };
}

export type DestinationsRepository = ReturnType<typeof createDestinationsRepository>;
