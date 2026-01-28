// Firehose Protocol Handler
// For decoding raw binary CBOR frames from ATProto relays

import type {
  FirehoseFrame,
  FirehoseCommitEvent,
  FirehoseCommitOp,
} from "./types";

// Use @ipld/dag-cbor for decoding - it properly handles CID tag 42
let decode: (data: Uint8Array) => unknown;

async function ensureCborLoaded() {
  if (!decode) {
    const dagCbor = await import("@ipld/dag-cbor");
    decode = dagCbor.decode;
  }
}

/**
 * Find the boundary between two concatenated CBOR values.
 * CBOR is self-delimiting, so we can find where the first value ends.
 */
function findCborBoundary(bytes: Uint8Array): number {
  let pos = 0;

  function readValue(): void {
    if (pos >= bytes.length) throw new Error("Unexpected end");

    const initial = bytes[pos++];
    const majorType = initial >> 5;
    const additionalInfo = initial & 0x1f;

    // Get the argument value
    let argValue = 0n;
    if (additionalInfo < 24) {
      argValue = BigInt(additionalInfo);
    } else if (additionalInfo === 24) {
      argValue = BigInt(bytes[pos++]);
    } else if (additionalInfo === 25) {
      argValue = BigInt((bytes[pos] << 8) | bytes[pos + 1]);
      pos += 2;
    } else if (additionalInfo === 26) {
      argValue = BigInt(
        (bytes[pos] << 24) |
          (bytes[pos + 1] << 16) |
          (bytes[pos + 2] << 8) |
          bytes[pos + 3],
      );
      pos += 4;
    } else if (additionalInfo === 27) {
      // 8-byte value
      argValue = 0n;
      for (let i = 0; i < 8; i++) {
        argValue = (argValue << 8n) | BigInt(bytes[pos++]);
      }
    } else if (additionalInfo === 31) {
      // Indefinite length - read until break
      if (majorType === 2 || majorType === 3) {
        // Indefinite byte/text string
        while (bytes[pos] !== 0xff) readValue();
        pos++; // skip break
      } else if (majorType === 4) {
        // Indefinite array
        while (bytes[pos] !== 0xff) readValue();
        pos++;
      } else if (majorType === 5) {
        // Indefinite map
        while (bytes[pos] !== 0xff) {
          readValue();
          readValue();
        }
        pos++;
      }
      return;
    }

    // Process based on major type
    switch (majorType) {
      case 0: // Unsigned integer
      case 1: // Negative integer
      case 7: // Simple/float
        // Value already consumed
        break;
      case 2: // Byte string
      case 3: // Text string
        pos += Number(argValue);
        break;
      case 4: // Array
        for (let i = 0n; i < argValue; i++) readValue();
        break;
      case 5: // Map
        for (let i = 0n; i < argValue; i++) {
          readValue();
          readValue();
        }
        break;
      case 6: // Tag
        readValue(); // Read tagged value
        break;
    }
  }

  readValue();
  return pos;
}

/** Available relay endpoints */
export const RELAY_ENDPOINTS = [
  { url: "wss://bsky.network", label: "Bluesky Network (Main)" },
];

/** Default relay endpoint */
export const DEFAULT_RELAY_ENDPOINT = RELAY_ENDPOINTS[0].url;

/** Frame type constants */
export const FRAME_TYPES = {
  MESSAGE: 1,
  ERROR: -1,
} as const;

/** Message types */
export const MESSAGE_TYPES = {
  COMMIT: "#commit",
  IDENTITY: "#identity",
  ACCOUNT: "#account",
  HANDLE: "#handle",
  TOMBSTONE: "#tombstone",
  INFO: "#info",
} as const;

/**
 * Build firehose WebSocket URL
 */
export function buildFirehoseUrl(endpoint: string, cursor?: number): string {
  const url = new URL(`${endpoint}/xrpc/com.atproto.sync.subscribeRepos`);

  if (cursor !== undefined) {
    url.searchParams.set("cursor", cursor.toString());
  }

  return url.toString();
}

/**
 * Decode a binary CBOR frame from the firehose.
 * The firehose sends two concatenated CBOR values: header and body.
 * We manually find the boundary between them since @ipld/dag-cbor
 * only decodes a single value at a time.
 */
export async function decodeFirehoseFrame(
  data: ArrayBuffer,
): Promise<FirehoseFrame | null> {
  await ensureCborLoaded();

  try {
    const bytes = new Uint8Array(data);

    // Find where the header ends
    const boundary = findCborBoundary(bytes);

    // Decode header (first CBOR value)
    const headerBytes = bytes.slice(0, boundary);
    const header = decode(headerBytes) as { op: number; t?: string };

    if (!header || typeof header.op !== "number") {
      return null;
    }

    // Decode body (second CBOR value)
    const bodyBytes = bytes.slice(boundary);
    const body = decode(bodyBytes);

    return {
      op: header.op as 1 | -1,
      t: header.t,
      body,
    };
  } catch (error) {
    // Log decode errors for debugging - firehose can have malformed frames
    if (import.meta.env.DEV) {
      console.warn("[Firehose] Failed to decode frame:", error);
    }
    return null;
  }
}

/**
 * Parse a commit event from the firehose body
 */
export function parseCommitEvent(body: unknown): FirehoseCommitEvent | null {
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  // Validate required fields
  if (!("repo" in b)) return null;

  // Handle ops - might be missing or empty
  const ops: FirehoseCommitOp[] = [];
  if (Array.isArray(b.ops)) {
    for (const op of b.ops) {
      const o = op as Record<string, unknown>;
      const action = o.action as string;
      // Only include valid actions
      if (action === "create" || action === "update" || action === "delete") {
        ops.push({
          action,
          path: (o.path as string) || "",
          cid: o.cid as { $link: string } | null | undefined,
        });
      }
    }
  }

  return {
    repo: b.repo as string,
    rev: (b.rev as string) || "",
    seq: (b.seq as number) || 0,
    since: (b.since as string) || null,
    time: (b.time as string) || new Date().toISOString(),
    tooBig: (b.tooBig as boolean) || false,
    rebase: (b.rebase as boolean) || false,
    blocks: b.blocks as Uint8Array,
    ops,
  };
}

/**
 * Format a commit event for display
 */
export function formatCommitEvent(commit: FirehoseCommitEvent): {
  summary: string;
  operations: { action: string; collection: string; rkey: string }[];
} {
  const operations = commit.ops.map((op) => {
    const parts = op.path.split("/");
    const collection = parts[0] || "";
    const rkey = parts[1] || "";
    return {
      action: op.action,
      collection,
      rkey,
    };
  });

  const opSummary = operations
    .map(
      (op) => `${op.action} ${op.collection.split(".").pop() || op.collection}`,
    )
    .join(", ");

  return {
    summary: opSummary || "No operations",
    operations,
  };
}

/**
 * Get color for operation action
 */
export function getActionColor(action: string): string {
  switch (action) {
    case "create":
      return "action-create";
    case "update":
      return "action-update";
    case "delete":
      return "action-delete";
    default:
      return "";
  }
}

/**
 * Get friendly name for message type
 */
export function getMessageTypeName(type: string): string {
  switch (type) {
    case MESSAGE_TYPES.COMMIT:
      return "Commit";
    case MESSAGE_TYPES.IDENTITY:
      return "Identity";
    case MESSAGE_TYPES.ACCOUNT:
      return "Account";
    case MESSAGE_TYPES.HANDLE:
      return "Handle";
    case MESSAGE_TYPES.TOMBSTONE:
      return "Tombstone";
    case MESSAGE_TYPES.INFO:
      return "Info";
    default:
      return type?.replace("#", "") || "Unknown";
  }
}

/**
 * Check if a commit event has navigable operations
 */
export function hasNavigableOps(commit: FirehoseCommitEvent): boolean {
  return commit.ops.some(
    (op) => op.action !== "delete" && op.path.includes("/"),
  );
}

/**
 * Get navigation path for an operation
 */
export function getOperationNavigationPath(
  repo: string,
  op: FirehoseCommitOp,
): string | null {
  if (op.action === "delete") return null;

  const [collection, rkey] = op.path.split("/");
  if (!collection || !rkey) return null;

  return `/at/${repo}/${collection}/${rkey}`;
}

// Re-export from consolidated format utilities
export { truncateDid, formatBytes } from "./format";

/**
 * Parsed firehose event for display
 */
export interface ParsedFirehoseEvent {
  seq: number;
  type: string;
  timestamp: Date;
  repo?: string;
  commit?: FirehoseCommitEvent;
  raw: FirehoseFrame;
  size: number;
}

/**
 * Parse a complete firehose event
 */
export async function parseFirehoseEvent(
  data: ArrayBuffer,
): Promise<ParsedFirehoseEvent | null> {
  const frame = await decodeFirehoseFrame(data);
  if (!frame) return null;

  const event: ParsedFirehoseEvent = {
    seq: 0,
    type: frame.t || "unknown",
    timestamp: new Date(),
    raw: frame,
    size: data.byteLength,
  };

  if (frame.t === MESSAGE_TYPES.COMMIT && frame.body) {
    const commit = parseCommitEvent(frame.body);
    if (commit) {
      event.seq = commit.seq;
      event.repo = commit.repo;
      event.commit = commit;
      if (commit.time) {
        event.timestamp = new Date(commit.time);
      }
    }
  }

  return event;
}
