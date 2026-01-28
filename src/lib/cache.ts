// localStorage cache with TTL support

import type { CacheEntry, ResolvedIdentity } from './types';

const CACHE_PREFIX = 'pdscan:';

// TTL values in milliseconds
export const TTL = {
  IDENTITY: 1000 * 60 * 60, // 1 hour - identities rarely change
  RECORD: 1000 * 60 * 5, // 5 minutes - records can be updated
  STATS: 1000 * 60, // 1 minute - stats update frequently
} as const;

function isServer(): boolean {
  return typeof window === 'undefined';
}

function getStorage(): Storage | null {
  if (isServer()) return null;
  return window.localStorage;
}

/** Set a value in cache with TTL */
export function setCache<T>(key: string, data: T, ttl: number): void {
  const storage = getStorage();
  if (!storage) return;

  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    ttl,
  };

  try {
    storage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('Cache write failed:', e);
  }
}

/** Get a value from cache, returns null if expired or missing */
export function getCache<T>(key: string): T | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();

    if (now - entry.cachedAt > entry.ttl) {
      // Expired - remove and return null
      storage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch (e) {
    console.warn('Cache read failed:', e);
    return null;
  }
}

/** Remove a specific key from cache */
export function removeCache(key: string): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(CACHE_PREFIX + key);
}

/** Clear all pdscan cache entries */
export function clearCache(): void {
  const storage = getStorage();
  if (!storage) return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}

// Specialized cache functions for common types

export function cacheIdentity(identifier: string, identity: ResolvedIdentity): void {
  // Cache by both handle and DID for easy lookup
  setCache(`identity:${identifier.toLowerCase()}`, identity, TTL.IDENTITY);
  if (identifier.toLowerCase() !== identity.did.toLowerCase()) {
    setCache(`identity:${identity.did.toLowerCase()}`, identity, TTL.IDENTITY);
  }
  if (identifier.toLowerCase() !== identity.handle.toLowerCase()) {
    setCache(`identity:${identity.handle.toLowerCase()}`, identity, TTL.IDENTITY);
  }
}

export function getCachedIdentity(identifier: string): ResolvedIdentity | null {
  return getCache<ResolvedIdentity>(`identity:${identifier.toLowerCase()}`);
}

// Recent searches for home page
const MAX_RECENT_SEARCHES = 10;

export interface RecentSearch {
  identifier: string;
  handle: string;
  did: string;
  searchedAt: number;
}

export function addRecentSearch(search: Omit<RecentSearch, 'searchedAt'>): void {
  const storage = getStorage();
  if (!storage) return;

  const recent = getRecentSearches();

  // Remove if already exists
  const filtered = recent.filter(
    (s) => s.did !== search.did && s.identifier !== search.identifier
  );

  // Add to front
  filtered.unshift({
    ...search,
    searchedAt: Date.now(),
  });

  // Keep only most recent
  const trimmed = filtered.slice(0, MAX_RECENT_SEARCHES);

  try {
    storage.setItem(CACHE_PREFIX + 'recent-searches', JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save recent search:', e);
  }
}

export function getRecentSearches(): RecentSearch[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(CACHE_PREFIX + 'recent-searches');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(CACHE_PREFIX + 'recent-searches');
}
