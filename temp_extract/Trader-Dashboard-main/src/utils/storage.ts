/**
 * Safe LocalStorage Utility with Schema Migration, Validation, & Hydration Fallbacks
 */

export function safeGetStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    if (parsed === null || parsed === undefined) return fallback;

    // Array check if fallback is array
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      console.warn(`[Storage] Invalid array data for key "${key}", using fallback.`);
      return fallback;
    }

    // Object shape sanity check if fallback is object
    if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`[Storage] Invalid object data for key "${key}", using fallback.`);
        return fallback;
      }
      // Merge with fallback to ensure any newly added keys are retained
      return { ...fallback, ...parsed };
    }

    return parsed as T;
  } catch (err) {
    console.error(`[Storage] Failed to load/parse key "${key}" from localStorage:`, err);
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to save key "${key}" to localStorage:`, err);
    return false;
  }
}
