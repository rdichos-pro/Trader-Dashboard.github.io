import { useEffect, useState } from 'react';
import { safeGetStorage, safeSetStorage } from './storage';

/**
 * Custom React hook for robust, type-safe, hydrated local storage synchronization.
 * Handles server/client hydration safely, graceful schema evolution, and instantaneous persistence.
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (valOrUpdater: T | ((prev: T) => T)) => void] {
  // Initialize with safe fallback / local storage content
  const [state, setState] = useState<T>(() => {
    return safeGetStorage<T>(key, initialValue);
  });

  // Keep state synced with localStorage on change
  useEffect(() => {
    safeSetStorage(key, state);
  }, [key, state]);

  return [state, setState];
}
