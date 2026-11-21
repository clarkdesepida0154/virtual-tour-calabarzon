/**
 * Saved field-trip plans bound to AsyncStorage (see ./tripPlans.ts for the
 * logic). Local to the phone; no database table, works offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPlanStore } from '@/lib/tripPlans';

export const tripPlans = createPlanStore(AsyncStorage);
