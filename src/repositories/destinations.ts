/**
 * Destinations repository — every read and write of the `destinations` table.
 *
 * It is a factory that receives the Supabase client, so the exact same code
 * runs in the app (see ./index.ts) and in scripts/verify-crud.mjs under Node.
 * Keep it free of React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Category, Province } from '@/constants/taxonomy';
import { AppError, toAppError } from '@/lib/errors';
import type {
  Database,
  Destination,
  DestinationInsert,
  DestinationSummary,
  DestinationUpdate,
} from '@/types/database';

const TABLE = 'destinations';

/**
 * Columns for lists and cards. The long texts (description, history, cultural
 * significance) are left out on purpose: a list of 26 destinations would
 * otherwise download every essay on each search keystroke.
 */
const SUMMARY_COLUMNS = 'id, name, municipality, province, category, cover_image_url';

/** Postgres "invalid text representation" — e.g. an id that is not a UUID. */
const INVALID_INPUT_SYNTAX = '22P02';

export type DestinationFilters = {
  /** Matched against name and municipality (case-insensitive, partial). */
  search?: string;
  category?: Category | null;
  province?: Province | null;
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

export function createDestinationsRepository(client: SupabaseClient<Database>) {
  /**
   * Destinations matching the filters, A–Z, as lightweight summaries.
   * Filters combine with AND; with no filters this is the whole collection.
   */
  async function list(filters: DestinationFilters = {}): Promise<DestinationSummary[]> {
    let query = client.from(TABLE).select(SUMMARY_COLUMNS);

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.province) query = query.eq('province', filters.province);

    const search = buildSearchFilter(filters.search ?? '');
    if (search) query = query.or(search);

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw toAppError(error, 'We couldn’t load the destinations.');
    return data;
  }

  /** One full destination, or `null` when it does not exist (or was deleted). */
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

  /** Deletes the destination; its photos, quiz and progress rows cascade. */
  async function remove(id: string): Promise<void> {
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) throw toAppError(error, 'We couldn’t delete the destination.');
  }

  return { list, getById, create, update, remove };
}

export type DestinationsRepository = ReturnType<typeof createDestinationsRepository>;
