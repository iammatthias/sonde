// Record fetching utilities for ATProto

import type {
  DID,
  AtUri,
  CID,
  Rkey,
  Lexicon,
  RepoRecord,
  RecordList,
  ParsedAtUri,
} from "./types";
import { dedupFetch } from "./memo";

/** Parse an AT-URI into its components */
export function parseAtUri(uri: AtUri | string): ParsedAtUri {
  // at://did:plc:xxx/app.bsky.feed.post/rkey
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }
  return {
    did: match[1] as DID,
    collection: match[2] as Lexicon,
    rkey: match[3] as Rkey,
  };
}

/** Build an AT-URI from components */
export function buildAtUri(did: DID, collection: Lexicon, rkey: Rkey): AtUri {
  return `at://${did}/${collection}/${rkey}` as AtUri;
}

/** List records in a collection with pagination */
export async function listRecords(
  pdsEndpoint: string,
  did: DID,
  collection: Lexicon,
  options: {
    limit?: number;
    cursor?: string;
    reverse?: boolean;
  } = {},
): Promise<RecordList> {
  const { limit = 50, cursor, reverse = true } = options;

  const params = new URLSearchParams({
    repo: did,
    collection,
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }
  if (reverse) {
    params.set("reverse", "true");
  }

  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.listRecords?${params}`;

  // Use deduplicated fetch for record listing
  try {
    const data = await dedupFetch<{ records: unknown[]; cursor?: string }>(url);
    return {
      records: data.records || [],
      cursor: data.cursor,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Failed to list records`,
    );
  }
}

/** Get a single record by AT-URI or components */
export async function getRecord(
  pdsEndpoint: string,
  did: DID,
  collection: Lexicon,
  rkey: Rkey,
): Promise<RepoRecord> {
  const params = new URLSearchParams({
    repo: did,
    collection,
    rkey,
  });

  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?${params}`;

  // Use deduplicated fetch for record retrieval
  try {
    const data = await dedupFetch<{ uri: string; cid: string; value: unknown }>(
      url,
    );
    return {
      uri: data.uri,
      cid: data.cid,
      value: data.value,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : `Failed to get record`,
    );
  }
}

/** Get blob URL for a CID */
export function getBlobUrl(pdsEndpoint: string, did: DID, cid: CID): string {
  return `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

/** Extract rkey from an AT-URI */
export function getRkeyFromUri(uri: AtUri | string): Rkey {
  const parts = uri.split("/");
  return parts[parts.length - 1] as Rkey;
}

/** Extract collection from an AT-URI */
export function getCollectionFromUri(uri: AtUri | string): Lexicon {
  const parts = uri.split("/");
  return parts[parts.length - 2] as Lexicon;
}

/** TID (Timestamp ID) to Date conversion
 * TIDs are 13-char base32-sortable identifiers:
 * - First 11 chars: microseconds since Unix epoch (53 bits)
 * - Last 2 chars: clock identifier for collision avoidance (10 bits)
 * See: https://atproto.com/specs/tid
 */
const TID_CHARS = "234567abcdefghijklmnopqrstuvwxyz";

export function tidToDate(tid: string): Date | null {
  if (!tid || tid.length !== 13) return null;

  try {
    // Only decode first 11 characters (timestamp portion)
    // Last 2 characters are clock ID, not part of timestamp
    const timestampChars = tid.slice(0, 11);
    let timestamp = 0n;
    for (const char of timestampChars) {
      const index = TID_CHARS.indexOf(char.toLowerCase());
      if (index === -1) return null;
      timestamp = timestamp * 32n + BigInt(index);
    }
    // TID encodes microseconds, convert to milliseconds for JS Date
    return new Date(Number(timestamp / 1000n));
  } catch {
    return null;
  }
}

/** Check if a string looks like a TID (13 chars, base32-sortable) */
export function isTid(str: string): boolean {
  if (str.length !== 13) return false;
  return [...str].every((c) => TID_CHARS.includes(c.toLowerCase()));
}

/** Format a record for display - extract key info based on lexicon */
export function getRecordPreview(record: RepoRecord): {
  title: string;
  subtitle: string;
  timestamp: Date | null;
} {
  const value = record.value as Record<string, unknown>;
  const rkey = getRkeyFromUri(record.uri);
  const collection = getCollectionFromUri(record.uri);

  // Try to get timestamp from record or rkey
  let timestamp: Date | null = null;
  if (value.createdAt && typeof value.createdAt === "string") {
    timestamp = new Date(value.createdAt);
  } else if (isTid(rkey)) {
    timestamp = tidToDate(rkey);
  }

  // Collection-specific previews
  switch (collection) {
    case "app.bsky.feed.post": {
      const text = (value.text as string) || "";
      return {
        title: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
        subtitle: rkey,
        timestamp,
      };
    }
    case "app.bsky.feed.like":
    case "app.bsky.feed.repost": {
      const subject = value.subject as { uri?: string } | undefined;
      return {
        title: collection.split(".").pop() || collection,
        subtitle: subject?.uri || rkey,
        timestamp,
      };
    }
    case "app.bsky.graph.follow":
    case "app.bsky.graph.block": {
      const subject = (value.subject as string) || "";
      return {
        title: collection.split(".").pop() || collection,
        subtitle: subject,
        timestamp,
      };
    }
    case "app.bsky.actor.profile": {
      const displayName = (value.displayName as string) || "";
      return {
        title: displayName || "Profile",
        subtitle: rkey,
        timestamp,
      };
    }
    default:
      return {
        title: rkey,
        subtitle: collection,
        timestamp,
      };
  }
}
