/**
 * The app's offline cache: src/lib/offlineCache.ts bound to AsyncStorage,
 * plus a tiny store that remembers whether the screens are currently showing
 * saved data (read with `useShowingSavedData()`).
 *
 * Photos are not stored here: expo-image keeps its own disk cache, so a photo
 * seen once usually still shows offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { createOfflineCache } from '@/lib/offlineCache';

let showingSavedData = false;
const listeners = new Set<() => void>();

function setShowingSavedData(next: boolean) {
  if (showingSavedData === next) return;
  showingSavedData = next;
  listeners.forEach((listener) => listener());
}

export const catalogueCache = createOfflineCache(AsyncStorage, {
  // Any read answered from the saved copy turns the banner on; the next one
  // answered by the network turns it off again.
  onSource: (source) => setShowingSavedData(source === 'cache'),
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while the latest catalogue read was served from the saved copy (offline). */
export function useShowingSavedData(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => showingSavedData,
    () => false,
  );
}
