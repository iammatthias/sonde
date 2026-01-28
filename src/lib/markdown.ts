// Lazy-loaded and memoized markdown parsing
// Reduces initial bundle size and prevents redundant parsing

import { LRUCache } from './memo';

// Lazy-loaded marked module
let markedModule: typeof import('marked') | null = null;
let loadingPromise: Promise<typeof import('marked')> | null = null;

// Cache for parsed markdown (key: source, value: HTML)
const markdownCache = new LRUCache<string, string>(200, 5 * 60 * 1000); // 5 min TTL

/**
 * Load the marked module lazily.
 * Returns cached module if already loaded.
 */
async function loadMarked(): Promise<typeof import('marked')> {
  if (markedModule) return markedModule;

  if (!loadingPromise) {
    loadingPromise = import('marked').then((mod) => {
      markedModule = mod;
      return mod;
    });
  }

  return loadingPromise;
}

/**
 * Check if marked is already loaded (for sync operations).
 */
export function isMarkedLoaded(): boolean {
  return markedModule !== null;
}

/**
 * Parse markdown to HTML asynchronously.
 * Lazy-loads the marked library and caches results.
 */
export async function parseMarkdownAsync(source: string): Promise<string> {
  // Check cache first
  const cached = markdownCache.get(source);
  if (cached !== undefined) return cached;

  // Load marked and parse
  const marked = await loadMarked();
  const html = marked.marked.parse(source, { async: false }) as string;

  // Cache result
  markdownCache.set(source, html);
  return html;
}

/**
 * Parse markdown synchronously (only works if marked is already loaded).
 * Falls back to returning source wrapped in <pre> if not loaded.
 */
export function parseMarkdownSync(source: string): string {
  // Check cache first
  const cached = markdownCache.get(source);
  if (cached !== undefined) return cached;

  // If marked isn't loaded, return escaped source
  if (!markedModule) {
    return `<pre>${escapeHtml(source)}</pre>`;
  }

  const html = markedModule.marked.parse(source, { async: false }) as string;
  markdownCache.set(source, html);
  return html;
}

/**
 * Preload the marked library.
 * Call this early to ensure it's available for sync parsing.
 */
export function preloadMarked(): Promise<void> {
  return loadMarked().then(() => {});
}

/**
 * Escape HTML entities for safe display.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if text looks like markdown.
 * Memoized for performance.
 */
const markdownPatternCache = new LRUCache<string, boolean>(500, 10 * 60 * 1000);

export function isLikelyMarkdown(text: string): boolean {
  // Use first 500 chars as cache key to avoid huge keys
  const cacheKey = text.slice(0, 500);
  const cached = markdownPatternCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const mdPatterns = [
    /^#{1,6}\s/m,           // Headers
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic
    /\[[^\]]+\]\([^)]+\)/,  // Links
    /```[\s\S]*?```/,       // Code blocks
    /^\s*[-*+]\s/m,         // Unordered lists
    /^\s*\d+\.\s/m,         // Ordered lists
    /^\s*>/m,               // Blockquotes
  ];

  const result = mdPatterns.some((pattern) => pattern.test(text));
  markdownPatternCache.set(cacheKey, result);
  return result;
}

/**
 * Clear markdown caches.
 */
export function clearMarkdownCache(): void {
  markdownCache.clear();
  markdownPatternCache.clear();
}
