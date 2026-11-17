/**
 * The data layer's public entry point. Screens, hooks and contexts import
 * repositories from here and never touch supabase-js themselves.
 */
import { supabase } from '@/lib/supabase';

import { createAuthRepository } from './auth';
import { createDestinationImagesRepository } from './destinationImages';
import { createDestinationsRepository } from './destinations';
import { createProgressRepository } from './progress';
import { createQuizRepository } from './quiz';

export const destinationsRepository = createDestinationsRepository(supabase);
export const destinationImagesRepository = createDestinationImagesRepository(supabase);
export const quizRepository = createQuizRepository(supabase);
export const progressRepository = createProgressRepository(supabase);
export const authRepository = createAuthRepository(supabase);

export type { DestinationFilters } from './destinations';
export type { SignUpResult } from './auth';
