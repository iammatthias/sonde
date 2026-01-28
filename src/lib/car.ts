// CAR (Content Addressable aRchive) File Handling
// For importing/inspecting and exporting ATProto repository archives

import type { ParsedCar, ParsedBlock, ExtractedRecord } from "./types";

// Dynamic imports for browser-only modules
let CarReader: typeof import("@ipld/car").CarReader;
let dagCbor: typeof import("@ipld/dag-cbor");

async function ensureModulesLoaded() {
  if (!CarReader) {
    const carModule = await import("@ipld/car");
    CarReader = carModule.CarReader;
  }
  if (!dagCbor) {
    dagCbor = await import("@ipld/dag-cbor");
  }
}

/** Maximum file size to parse in browser (50MB) */
export const MAX_CAR_SIZE = 50 * 1024 * 1024;

/** File size warning threshold (10MB) */
export const CAR_SIZE_WARNING = 10 * 1024 * 1024;

/**
 * Parse a CAR file from bytes
 */
export async function parseCar(
  input: Uint8Array | ArrayBuffer,
): Promise<ParsedCar> {
  await ensureModulesLoaded();

  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  if (bytes.length > MAX_CAR_SIZE) {
    throw new Error(
      `File too large (${formatBytes(bytes.length)}). Maximum size is ${formatBytes(MAX_CAR_SIZE)}.`,
    );
  }

  const reader = await CarReader.fromBytes(bytes);
  const roots = await reader.getRoots();

  const blocks: ParsedBlock[] = [];
  const records: ExtractedRecord[] = [];

  // Iterate through all blocks
  for await (const { cid, bytes: blockBytes } of reader.blocks()) {
    let decoded: unknown = null;

    try {
      decoded = dagCbor.decode(blockBytes);
    } catch {
      // Not all blocks are CBOR - some might be raw data
      decoded = { _raw: true, size: blockBytes.length };
    }

    blocks.push({
      cid: cid.toString(),
      bytes: blockBytes,
      decoded,
    });

    // Try to extract record info if this looks like a record
    if (
      decoded &&
      typeof decoded === "object" &&
      "$type" in (decoded as object)
    ) {
      const record = decoded as { $type: string; [key: string]: unknown };
      // Extract collection from $type
      const collection = record.$type;
      // We don't have rkey info from just the block, but we can still show the record
      records.push({
        collection,
        rkey: "unknown", // Would need MST traversal to get actual rkey
        cid: cid.toString(),
        value: decoded,
      });
    }
  }

  return {
    roots: roots.map((r) => r.toString()),
    blocks,
    records,
  };
}

/**
 * Parse a CAR file from a URL
 */
export async function fetchAndParseCar(url: string): Promise<ParsedCar> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch CAR file: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_CAR_SIZE) {
    throw new Error(
      `File too large (${formatBytes(parseInt(contentLength))}). Maximum size is ${formatBytes(MAX_CAR_SIZE)}.`,
    );
  }

  const buffer = await response.arrayBuffer();
  return parseCar(buffer);
}

/**
 * Get the URL for downloading a repo as CAR
 */
export function getRepoCarUrl(pdsEndpoint: string, did: string): string {
  const params = new URLSearchParams({ did });
  return `${pdsEndpoint}/xrpc/com.atproto.sync.getRepo?${params.toString()}`;
}

/**
 * Download a repo as a CAR file (triggers browser download)
 */
export async function downloadRepoCar(
  pdsEndpoint: string,
  did: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<void> {
  const url = getRepoCarUrl(pdsEndpoint, did);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download repo: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength) : null;

  // Use streaming to track progress
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  // Combine chunks
  const blob = new Blob(chunks as BlobPart[], {
    type: "application/vnd.ipld.car",
  });

  // Trigger download
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${did.replace(/:/g, "-")}.car`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// Re-export from consolidated format utilities
export { formatBytes } from "./format";

/**
 * Get block type description
 */
export function getBlockType(decoded: unknown): string {
  if (!decoded || typeof decoded !== "object") {
    return "Unknown";
  }

  const obj = decoded as Record<string, unknown>;

  if ("_raw" in obj) {
    return "Raw Data";
  }

  if ("$type" in obj) {
    return obj.$type as string;
  }

  // MST node
  if ("e" in obj && Array.isArray(obj.e)) {
    return "MST Node";
  }

  // Commit
  if ("data" in obj && "rev" in obj) {
    return "Commit";
  }

  return "Data Block";
}

/**
 * Truncate CID for display
 */
export function truncateCid(cid: string, maxLength: number = 20): string {
  if (cid.length <= maxLength) return cid;
  const prefix = cid.slice(0, 10);
  const suffix = cid.slice(-8);
  return `${prefix}...${suffix}`;
}

/**
 * Check if a file is likely a CAR file by extension
 */
export function isCarFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".car");
}

/**
 * Read a file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
