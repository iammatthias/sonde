// Jetstream Protocol Handler
// Jetstream provides a simplified, JSON-based event stream from the AT Protocol network

import type { JetstreamEvent, JetstreamOptions } from "./types";

/** Available Jetstream endpoints */
export const JETSTREAM_ENDPOINTS = [
  {
    url: "wss://jetstream1.us-east.bsky.network/subscribe",
    label: "US East 1",
  },
  {
    url: "wss://jetstream2.us-east.bsky.network/subscribe",
    label: "US East 2",
  },
  {
    url: "wss://jetstream1.us-west.bsky.network/subscribe",
    label: "US West 1",
  },
  {
    url: "wss://jetstream2.us-west.bsky.network/subscribe",
    label: "US West 2",
  },
];

/** Default endpoint */
export const DEFAULT_JETSTREAM_ENDPOINT = JETSTREAM_ENDPOINTS[0].url;

/** Common collection filters */
export const COMMON_COLLECTIONS = [
  { value: "app.bsky.feed.post", label: "Posts" },
  { value: "app.bsky.feed.like", label: "Likes" },
  { value: "app.bsky.feed.repost", label: "Reposts" },
  { value: "app.bsky.graph.follow", label: "Follows" },
  { value: "app.bsky.graph.block", label: "Blocks" },
  { value: "app.bsky.graph.list", label: "Lists" },
  { value: "app.bsky.graph.listitem", label: "List Items" },
  { value: "app.bsky.actor.profile", label: "Profiles" },
  { value: "app.bsky.feed.generator", label: "Feed Generators" },
  { value: "app.bsky.labeler.service", label: "Labelers" },
];

/**
 * Build a Jetstream WebSocket URL with optional filters
 */
export function buildJetstreamUrl(
  endpoint: string,
  options: JetstreamOptions = {},
): string {
  const url = new URL(endpoint);

  if (options.wantedCollections && options.wantedCollections.length > 0) {
    for (const collection of options.wantedCollections) {
      url.searchParams.append("wantedCollections", collection);
    }
  }

  if (options.wantedDids && options.wantedDids.length > 0) {
    for (const did of options.wantedDids) {
      url.searchParams.append("wantedDids", did);
    }
  }

  if (options.cursor !== undefined) {
    url.searchParams.set("cursor", options.cursor.toString());
  }

  return url.toString();
}

/**
 * Parse a Jetstream JSON message
 */
export function parseJetstreamEvent(data: string): JetstreamEvent | null {
  try {
    const event = JSON.parse(data) as JetstreamEvent;

    // Validate minimum required fields
    if (!event.did || !event.time_us || !event.kind) {
      return null;
    }

    return event;
  } catch {
    return null;
  }
}

/**
 * Convert Jetstream microsecond timestamp to Date
 */
export function jetstreamTimestampToDate(timeUs: number): Date {
  return new Date(timeUs / 1000);
}

/**
 * Format a Jetstream event for display
 */
export function formatJetstreamEvent(event: JetstreamEvent): {
  type: string;
  action: string;
  collection?: string;
  rkey?: string;
  summary: string;
} {
  const timestamp = jetstreamTimestampToDate(event.time_us);
  const timeStr = timestamp.toLocaleTimeString();

  switch (event.kind) {
    case "commit":
      if (event.commit) {
        const collectionShort =
          event.commit.collection.split(".").pop() || event.commit.collection;
        return {
          type: "commit",
          action: event.commit.operation,
          collection: event.commit.collection,
          rkey: event.commit.rkey,
          summary: `${event.commit.operation} ${collectionShort}`,
        };
      }
      return { type: "commit", action: "unknown", summary: "Unknown commit" };

    case "identity":
      if (event.identity) {
        return {
          type: "identity",
          action: "update",
          summary: `Handle: ${event.identity.handle}`,
        };
      }
      return { type: "identity", action: "update", summary: "Identity update" };

    case "account":
      if (event.account) {
        const status = event.account.active
          ? "active"
          : event.account.status || "inactive";
        return {
          type: "account",
          action: status,
          summary: `Account ${status}`,
        };
      }
      return { type: "account", action: "update", summary: "Account update" };

    default:
      return { type: event.kind, action: "unknown", summary: "Unknown event" };
  }
}

/**
 * Get color class for event type
 */
export function getEventTypeColor(type: string): string {
  switch (type) {
    case "commit":
      return "badge-accent";
    case "identity":
      return "badge-dark";
    case "account":
      return "";
    default:
      return "";
  }
}

/**
 * Get color class for operation type
 */
export function getOperationColor(operation: string): string {
  switch (operation) {
    case "create":
      return "op-create";
    case "update":
      return "op-update";
    case "delete":
      return "op-delete";
    default:
      return "";
  }
}

/**
 * Check if an event is navigable (can link to a record)
 */
export function isNavigableEvent(event: JetstreamEvent): boolean {
  return (
    event.kind === "commit" &&
    event.commit !== undefined &&
    event.commit.operation !== "delete" &&
    !!event.commit.collection &&
    !!event.commit.rkey
  );
}

/**
 * Get navigation path for an event
 */
export function getEventNavigationPath(event: JetstreamEvent): string | null {
  if (!isNavigableEvent(event) || !event.commit) {
    return null;
  }

  return `/at/${event.did}/${event.commit.collection}/${event.commit.rkey}`;
}

/**
 * Extract post text from a commit event (if it's a post)
 */
export function extractPostText(event: JetstreamEvent): string | null {
  if (
    event.kind !== "commit" ||
    !event.commit ||
    event.commit.collection !== "app.bsky.feed.post" ||
    !event.commit.record
  ) {
    return null;
  }

  const record = event.commit.record as { text?: string };
  return record.text || null;
}

// Re-export from consolidated format utilities
export { truncateDid } from "./format";
