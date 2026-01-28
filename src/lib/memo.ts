// Memoization utilities for performance optimization

/**
 * LRU Cache with TTL support for memoizing expensive computations.
 * Uses Map's insertion-order iteration for LRU eviction.
 */
export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttlMs: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Delete existing to reset position
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
    });
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Memoize a function with LRU caching.
 * Key is generated from stringified arguments.
 */
export function memoize<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  options: { maxSize?: number; ttl?: number; keyFn?: (...args: Args) => string } = {}
): (...args: Args) => R {
  const cache = new LRUCache<string, R>(options.maxSize ?? 500, options.ttl ?? 60000);
  const keyFn = options.keyFn ?? ((...args: Args) => JSON.stringify(args));

  return (...args: Args): R => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Memoize an async function with LRU caching.
 * Deduplicates in-flight requests for the same key.
 */
export function memoizeAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  options: { maxSize?: number; ttl?: number; keyFn?: (...args: Args) => string } = {}
): (...args: Args) => Promise<R> {
  const cache = new LRUCache<string, R>(options.maxSize ?? 500, options.ttl ?? 60000);
  const inflight = new Map<string, Promise<R>>();
  const keyFn = options.keyFn ?? ((...args: Args) => JSON.stringify(args));

  return async (...args: Args): Promise<R> => {
    const key = keyFn(...args);

    // Return cached result
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    // Return in-flight request if exists (deduplication)
    const pending = inflight.get(key);
    if (pending) return pending;

    // Make new request
    const promise = fn(...args)
      .then((result) => {
        cache.set(key, result);
        inflight.delete(key);
        return result;
      })
      .catch((error) => {
        inflight.delete(key);
        throw error;
      });

    inflight.set(key, promise);
    return promise;
  };
}

/**
 * Create a deduplicating fetch wrapper.
 * Multiple calls to the same URL within the TTL will share the same request.
 */
export function createDeduplicatedFetch(ttlMs: number = 5000) {
  const cache = new LRUCache<string, unknown>(200, ttlMs);
  const inflight = new Map<string, Promise<unknown>>();

  return async function dedupFetch<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    // Only deduplicate GET requests
    const method = options?.method?.toUpperCase() ?? 'GET';
    if (method !== 'GET') {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      return response.json();
    }

    const key = url;

    // Return cached result
    const cached = cache.get(key);
    if (cached !== undefined) return cached as T;

    // Return in-flight request
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    // Make new request
    const promise = fetch(url, options)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const data = await response.json();
        cache.set(key, data);
        inflight.delete(key);
        return data;
      })
      .catch((error) => {
        inflight.delete(key);
        throw error;
      });

    inflight.set(key, promise);
    return promise as Promise<T>;
  };
}

// Global deduplicating fetch instance
export const dedupFetch = createDeduplicatedFetch(5000);
