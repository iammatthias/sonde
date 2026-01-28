// Constellation API Client
// https://constellation.microcosm.blue - Backlinks and reference tracking for ATProto

import type { AtUri, DID } from "./types";

const CONSTELLATION_API = "https://constellation.microcosm.blue";

/** Backlink entry from Constellation API */
export interface Backlink {
  uri: AtUri;
  cid: string;
  indexedAt: string;
}

/** Response from getBacklinks endpoint */
export interface BacklinksResponse {
  subject: AtUri;
  source: string;
  backlinks: Backlink[];
  cursor?: string;
}

/** Link count entry */
export interface LinkCount {
  source: string;
  count: number;
}

/** Response from getAllLinkCounts (via /links/count) */
export interface LinkCountsResponse {
  target: AtUri;
  counts: LinkCount[];
  total: number;
}

/** Options for getBacklinks */
export interface GetBacklinksOptions {
  did?: DID[];
  limit?: number;
  cursor?: string;
  reverse?: boolean;
}

/**
 * Get backlinks to a record from a specific source collection
 *
 * @param subject - The AT-URI of the record to find backlinks for
 * @param source - The lexicon of the source collection (e.g., "app.bsky.feed.like")
 * @param options - Optional filters (DIDs, limit, cursor, reverse order)
 */
export async function getBacklinks(
  subject: AtUri,
  source: string,
  options?: GetBacklinksOptions
): Promise<BacklinksResponse | null> {
  try {
    const params = new URLSearchParams({
      subject,
      source,
    });

    if (options?.did?.length) {
      options.did.forEach((d) => params.append("did", d));
    }
    if (options?.limit) {
      params.set("limit", options.limit.toString());
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }
    if (options?.reverse) {
      params.set("reverse", "true");
    }

    const response = await fetch(
      `${CONSTELLATION_API}/xrpc/blue.microcosm.links.getBacklinks?${params}`
    );

    if (!response.ok) {
      console.warn(`Constellation API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch backlinks from Constellation:", error);
    return null;
  }
}

/**
 * Get all link counts for a record (likes, reposts, quotes, etc.)
 *
 * @param target - The AT-URI of the record to get counts for
 */
export async function getAllLinkCounts(
  target: AtUri
): Promise<LinkCountsResponse | null> {
  try {
    const params = new URLSearchParams({ target });
    const response = await fetch(
      `${CONSTELLATION_API}/links/count?${params}`
    );

    if (!response.ok) {
      console.warn(`Constellation API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Transform the response to our expected format
    const counts: LinkCount[] = [];
    let total = 0;

    if (data && typeof data === "object") {
      for (const [source, count] of Object.entries(data)) {
        if (typeof count === "number") {
          counts.push({ source, count });
          total += count;
        }
      }
    }

    return { target, counts, total };
  } catch (error) {
    console.warn("Failed to fetch link counts from Constellation:", error);
    return null;
  }
}

/**
 * Common source collections for backlinks
 */
export const BACKLINK_SOURCES = {
  like: "app.bsky.feed.like",
  repost: "app.bsky.feed.repost",
  quote: "app.bsky.feed.post", // Quotes are posts with embed
  reply: "app.bsky.feed.post", // Replies are posts with reply ref
  follow: "app.bsky.graph.follow",
  block: "app.bsky.graph.block",
  list: "app.bsky.graph.listitem",
} as const;

/**
 * Human-readable labels for backlink sources
 */
export const BACKLINK_LABELS: Record<string, string> = {
  "app.bsky.feed.like": "Likes",
  "app.bsky.feed.repost": "Reposts",
  "app.bsky.feed.post": "Quotes & Replies",
  "app.bsky.graph.follow": "Follows",
  "app.bsky.graph.block": "Blocks",
  "app.bsky.graph.listitem": "List Items",
};

/**
 * Get a human-readable label for a backlink source
 */
export function getBacklinkLabel(source: string): string {
  return BACKLINK_LABELS[source] || source.split(".").pop() || source;
}
