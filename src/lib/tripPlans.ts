/**
 * Saved field-trip plans (Run 6), kept on the phone only (AsyncStorage —
 * no database table). The store is injected, like ./offlineCache.ts, so the
 * logic is unit-tested in Node; ./appTripPlans.ts binds it to AsyncStorage.
 */
import { MAX_STOPS } from '@/lib/planner';
import { parseStoredRoute } from '@/lib/routing';
import type { RoadRoute } from '@/lib/routing';

export const TRIP_PLANS_KEY = 'vtour.tripPlans';
export const MAX_PLAN_NAME = 60;
export const MAX_SAVED_PLANS = 30;

export type TripPlan = {
  id: string;
  name: string;
  /** Destination ids in the chosen order. */
  stopIds: string[];
  /** Start from the person's location (when allowed) instead of the first stop. */
  fromLocation: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Run 8: the last OSRM road route for this order (geometry + legs), so a
   * saved plan opens with its road line at once — and offline. Reused only
   * while its key matches the plan's points (src/lib/routing.ts).
   */
  route?: RoadRoute | null;
};

export type PlanStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

function isPlan(value: unknown): value is TripPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    Array.isArray(plan.stopIds) &&
    plan.stopIds.every((id) => typeof id === 'string') &&
    typeof plan.fromLocation === 'boolean' &&
    typeof plan.createdAt === 'string' &&
    typeof plan.updatedAt === 'string'
  );
}

/** Parses the stored list; broken or foreign data → []. Newest first. */
export function parsePlans(raw: string | null | undefined): TripPlan[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(isPlan)
      .map((plan) => ({ ...plan, stopIds: plan.stopIds.slice(0, MAX_STOPS), route: parseStoredRoute(plan.route) }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function cleanPlanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_PLAN_NAME);
}

export function createPlanStore(store: PlanStore, now: () => Date = () => new Date()) {
  async function list(): Promise<TripPlan[]> {
    try {
      return parsePlans(await store.getItem(TRIP_PLANS_KEY));
    } catch {
      return [];
    }
  }

  async function write(plans: TripPlan[]): Promise<void> {
    await store.setItem(TRIP_PLANS_KEY, JSON.stringify(plans.slice(0, MAX_SAVED_PLANS)));
  }

  /** Saves a new plan, or replaces the one with the same id. Returns the saved plan. */
  async function save(input: {
    id?: string;
    name: string;
    stopIds: string[];
    fromLocation: boolean;
    route?: RoadRoute | null;
  }): Promise<TripPlan> {
    const plans = await list();
    const stamp = now().toISOString();
    const existing = input.id ? plans.find((plan) => plan.id === input.id) : undefined;
    const plan: TripPlan = {
      id: existing?.id ?? input.id ?? `plan-${now().getTime().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      name: cleanPlanName(input.name),
      stopIds: input.stopIds.slice(0, MAX_STOPS),
      fromLocation: input.fromLocation,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      route: input.route ?? null,
    };
    await write([plan, ...plans.filter((item) => item.id !== plan.id)]);
    return plan;
  }

  async function remove(id: string): Promise<void> {
    const plans = await list();
    await write(plans.filter((plan) => plan.id !== id));
  }

  /**
   * Caches a freshly fetched road route on a saved plan without touching its
   * name, order or dates. Ignored when the plan is gone.
   */
  async function attachRoute(id: string, route: RoadRoute | null): Promise<void> {
    const plans = await list();
    if (!plans.some((plan) => plan.id === id)) return;
    await write(plans.map((plan) => (plan.id === id ? { ...plan, route } : plan)));
  }

  return { list, save, remove, attachRoute };
}

export type PlanStoreApi = ReturnType<typeof createPlanStore>;
