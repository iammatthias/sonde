// Decoding utilities for ATProto record data
// Handles various encodings: AT-URIs, CIDs, blob refs, TIDs, bytes, etc.

import type {
  EncodingType,
  DecodedValue,
  BlobRef,
  StrongRef,
  DID,
  AtUri,
} from "./types";
import { tidToDate, isTid } from "./records";
import { LRUCache } from "./memo";

// Cache for decoded values - avoids re-decoding on every render
const decodeCache = new LRUCache<string, DecodedValue>(2000, 5 * 60 * 1000);

/** Check if value is an AT-URI */
export function isAtUri(value: unknown): value is AtUri {
  return typeof value === "string" && value.startsWith("at://");
}

/** Check if value looks like a DID */
export function isDid(value: unknown): value is DID {
  return typeof value === "string" && value.startsWith("did:");
}

/** Check if value looks like a CID (content identifier) */
export function isCid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // CIDs are typically base32 or base58 encoded, starting with 'b' or 'Q' or 'bafy'
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,}|bafy[a-z2-7]+)$/i.test(
    value,
  );
}

/** Check if value is a blob reference */
export function isBlobRef(value: unknown): value is BlobRef {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.$type === "blob" && !!obj.ref && typeof obj.ref === "object";
}

/** Check if value is a strong reference to another record */
export function isStrongRef(value: unknown): value is StrongRef {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.uri === "string" &&
    obj.uri.startsWith("at://") &&
    typeof obj.cid === "string"
  );
}

/** Check if value looks like an ISO datetime string */
export function isDatetime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // ISO 8601 format
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

/** Check if value looks like base64 encoded data */
export function isBase64(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // Base64 pattern: alphanumeric + /+ and optional = padding
  // Minimum length to avoid false positives
  if (value.length < 20) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0;
}

/** Check if value is a Uint8Array or byte-like */
export function isBytes(value: unknown): boolean {
  if (value instanceof Uint8Array) return true;
  if (
    Array.isArray(value) &&
    value.every((v) => typeof v === "number" && v >= 0 && v <= 255)
  ) {
    return true;
  }
  return false;
}

/** Detect the encoding type of a value */
export function detectEncoding(value: unknown): EncodingType {
  if (isAtUri(value)) return "at-uri";
  if (isDid(value)) return "did";
  if (isBlobRef(value)) return "blob-ref";
  if (isStrongRef(value)) return "strong-ref";
  if (typeof value === "string" && isTid(value)) return "tid";
  if (isDatetime(value)) return "datetime";
  if (isCid(value)) return "cid";
  if (isBase64(value)) return "base64";
  if (isBytes(value)) return "bytes";
  return "unknown";
}

/** Decode base64 to bytes */
export function decodeBase64(str: string): Uint8Array {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Format bytes as hex string */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

/** Try to decode bytes as UTF-8 text */
export function bytesToUtf8(bytes: Uint8Array | number[]): string | null {
  try {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(arr);
  } catch {
    return null;
  }
}

/** Generate cache key for a value */
function getCacheKey(value: unknown, key?: string): string | null {
  // Only cache simple types that can be stringified cheaply
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return `s:${key ?? ""}:${value.slice(0, 200)}`;
  if (typeof value === "number") return `n:${key ?? ""}:${value}`;
  if (typeof value === "boolean") return `b:${key ?? ""}:${value}`;
  // For objects, use a hash of the JSON if small enough
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json.length < 500) return `o:${key ?? ""}:${json}`;
    } catch {
      // Can't stringify, don't cache
    }
  }
  return null;
}

/** Decode a value and return decoded info */
export function decodeValue(value: unknown, key?: string): DecodedValue {
  // Check cache first
  const cacheKey = getCacheKey(value, key);
  if (cacheKey) {
    const cached = decodeCache.get(cacheKey);
    if (cached) return cached;
  }

  const result = decodeValueInternal(value, key);

  // Cache the result
  if (cacheKey) {
    decodeCache.set(cacheKey, result);
  }

  return result;
}

/** Internal decode logic (uncached) */
function decodeValueInternal(value: unknown, key?: string): DecodedValue {
  const type = detectEncoding(value);

  switch (type) {
    case "at-uri": {
      // at://did:plc:xxx/collection/rkey -> /at/did:plc:xxx/collection/rkey
      const path = (value as string).replace("at://", "");
      return {
        original: value,
        type,
        decoded: value,
        displayValue: value as string,
        isNavigable: true,
        navigateTo: `/at/${path}`,
      };
    }

    case "did":
      return {
        original: value,
        type,
        decoded: value,
        displayValue: value as string,
        isNavigable: true,
        navigateTo: `/at/${value as string}`,
      };

    case "strong-ref": {
      const ref = value as StrongRef;
      // at://did:plc:xxx/collection/rkey -> /at/did:plc:xxx/collection/rkey
      const path = ref.uri.replace("at://", "");
      return {
        original: value,
        type,
        decoded: { uri: ref.uri, cid: ref.cid },
        displayValue: ref.uri,
        isNavigable: true,
        navigateTo: `/at/${path}`,
      };
    }

    case "blob-ref": {
      const blob = value as BlobRef;
      return {
        original: value,
        type,
        decoded: {
          cid: blob.ref.$link,
          mimeType: blob.mimeType,
          size: blob.size,
        },
        displayValue: `Blob: ${blob.mimeType} (${formatBytes(blob.size)})`,
        isNavigable: false,
      };
    }

    case "tid": {
      const date = tidToDate(value as string);
      return {
        original: value,
        type,
        decoded: date,
        displayValue: date
          ? `${value} (${date.toISOString()})`
          : (value as string),
        isNavigable: false,
      };
    }

    case "datetime": {
      const date = new Date(value as string);
      return {
        original: value,
        type,
        decoded: date,
        displayValue: date.toLocaleString(),
        isNavigable: false,
      };
    }

    case "cid":
      return {
        original: value,
        type,
        decoded: value,
        displayValue: value as string,
        isNavigable: false,
      };

    case "base64": {
      const bytes = decodeBase64(value as string);
      const utf8 = bytesToUtf8(bytes);
      return {
        original: value,
        type,
        decoded: { bytes, utf8 },
        displayValue: utf8 || bytesToHex(bytes).slice(0, 50) + "...",
        isNavigable: false,
      };
    }

    case "bytes": {
      const arr =
        value instanceof Uint8Array ? value : new Uint8Array(value as number[]);
      const utf8 = bytesToUtf8(arr);
      return {
        original: value,
        type,
        decoded: { bytes: arr, utf8 },
        displayValue: utf8 || bytesToHex(arr).slice(0, 50) + "...",
        isNavigable: false,
      };
    }

    default:
      return {
        original: value,
        type: "unknown",
        decoded: value,
        displayValue: typeof value === "string" ? value : JSON.stringify(value),
        isNavigable: false,
      };
  }
}

// Re-export from consolidated format utilities
export { formatBytes } from "./format";

/** Recursively decode all values in an object */
export function decodeRecord(record: unknown): Map<string, DecodedValue> {
  const decoded = new Map<string, DecodedValue>();

  function walk(obj: unknown, path: string = "") {
    if (obj === null || obj === undefined) return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        walk(item, `${path}[${index}]`);
      });
      return;
    }

    if (typeof obj === "object") {
      // Check if the object itself is a special type
      const objDecoded = decodeValue(obj, path);
      if (objDecoded.type !== "unknown") {
        decoded.set(path, objDecoded);
        return;
      }

      // Otherwise, walk its properties
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>,
      )) {
        const newPath = path ? `${path}.${key}` : key;

        // Decode the value
        const valueDecoded = decodeValue(value, key);
        if (valueDecoded.type !== "unknown") {
          decoded.set(newPath, valueDecoded);
        }

        // Recurse into nested objects
        if (value && typeof value === "object") {
          walk(value, newPath);
        }
      }
    }
  }

  walk(record);
  return decoded;
}

/** Get all navigable references from a record */
export function getReferences(
  record: unknown,
): Array<{ path: string; uri: string; type: string }> {
  const decoded = decodeRecord(record);
  const refs: Array<{ path: string; uri: string; type: string }> = [];

  for (const [path, value] of decoded) {
    if (value.isNavigable && value.navigateTo) {
      refs.push({
        path,
        uri: value.displayValue,
        type: value.type,
      });
    }
  }

  return refs;
}

/** Parse an AT-URI into its components */
export function parseAtUri(
  uri: AtUri | string,
): { did: DID; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    did: match[1] as DID,
    collection: match[2],
    rkey: match[3],
  };
}
