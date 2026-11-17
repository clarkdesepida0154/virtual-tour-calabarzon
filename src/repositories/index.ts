/**
 * The data layer's public entry point. Screens, hooks and components import
 * repositories from here and never touch supabase-js themselves.
 */
import { supabase } from '@/lib/supabase';

import { createDestinationImagesRepository } from './destinationImages';
import { createDestinationsRepository } from './destinations';

export const destinationsRepository = createDestinationsRepository(supabase);
export const destinationImagesRepository = createDestinationImagesRepository(supabase);

export type { DestinationCounts, DestinationFilters } from './destinations';
