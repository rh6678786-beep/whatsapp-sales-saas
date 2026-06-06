/**
 * Simple in-memory API response cache.
 * Prevents duplicate GET requests to the same URL within the TTL window.
 * Useful for debouncing /api/settings calls from multiple components on mount.
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 5000; // 5 seconds

// Endpoints eligible for response caching
const CACHEABLE_PATTERNS = [
  '/api/settings',
  '/api/email-report/settings',
  '/api/health',
];

function isCacheable(url: string): boolean {
  return CACHEABLE_PATTERNS.some(pattern => url.includes(pattern));
}

/**
 * Get a cached response if available and not expired.
 */
export function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store a response in cache.
 */
export function setCached(key: string, data: any, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clear all cached entries or a specific key.
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * Axios request interceptor: skip the request if we have a fresh cached response.
 * Returns a resolved promise with cached data, or undefined to let the request proceed.
 */
export function cachedGetInterceptor(url: string): any | undefined {
  if (!isCacheable(url)) return undefined;

  const cached = getCached(url);
  if (cached !== null) {
    return cached;
  }

  return undefined; // Let the request proceed
}

/**
 * Axios response interceptor: store successful GET responses in cache.
 */
export function cacheResponseInterceptor(url: string, data: any): void {
  if (isCacheable(url)) {
    setCached(url, data);
  }
}
