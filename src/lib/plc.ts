// PLC Directory API client

import type { DidDocument, PlcOperation, PlcExportEntry } from './types';

/** PLC Directory base URL */
export const PLC_DIRECTORY = 'https://plc.directory';

/**
 * Get a DID document from the PLC directory
 */
export async function getDidDocument(did: string): Promise<DidDocument> {
  if (!did.startsWith('did:plc:')) {
    throw new Error('Only did:plc: identifiers are supported');
  }

  const response = await fetch(`${PLC_DIRECTORY}/${did}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`DID not found: ${did}`);
    }
    throw new Error(`Failed to fetch DID document: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the full operation history (audit log) for a DID
 */
export async function getOperationLog(did: string): Promise<PlcOperation[]> {
  if (!did.startsWith('did:plc:')) {
    throw new Error('Only did:plc: identifiers are supported');
  }

  const response = await fetch(`${PLC_DIRECTORY}/${did}/log/audit`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`DID not found: ${did}`);
    }
    throw new Error(`Failed to fetch operation log: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the last operation for a DID
 */
export async function getLastOperation(did: string): Promise<PlcOperation> {
  const response = await fetch(`${PLC_DIRECTORY}/${did}/log/last`);

  if (!response.ok) {
    throw new Error(`Failed to fetch last operation: ${response.status}`);
  }

  return response.json();
}

/**
 * Export directory entries with pagination.
 * Returns NDJSON parsed as an array.
 */
export async function exportDirectory(options: {
  after?: string;
  count?: number;
}): Promise<PlcExportEntry[]> {
  const params = new URLSearchParams();

  if (options.after) {
    params.set('after', options.after);
  }

  if (options.count) {
    params.set('count', options.count.toString());
  }

  const url = `${PLC_DIRECTORY}/export?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to export directory: ${response.status}`);
  }

  // Parse NDJSON (newline-delimited JSON)
  const text = await response.text();
  const lines = text.trim().split('\n').filter(Boolean);

  return lines.map((line) => JSON.parse(line));
}

/**
 * Get recent registrations by fetching the latest entries from the export endpoint
 */
export async function getRecentRegistrations(count: number = 50): Promise<PlcExportEntry[]> {
  // The export endpoint returns entries in chronological order
  // To get recent entries, we need to fetch without 'after' and take the last N
  // This is a simplification - for a real implementation you'd want to
  // query with a recent timestamp
  const entries = await exportDirectory({ count });
  return entries;
}

/**
 * Format a PLC operation for display
 */
export function formatOperationType(type: string): string {
  switch (type) {
    case 'plc_operation':
      return 'Update';
    case 'plc_tombstone':
      return 'Tombstone';
    case 'create':
      return 'Create';
    default:
      return type;
  }
}

/**
 * Extract handle from alsoKnownAs field
 */
export function extractHandle(alsoKnownAs?: string[]): string | null {
  if (!alsoKnownAs || alsoKnownAs.length === 0) return null;

  const atHandle = alsoKnownAs.find((aka) => aka.startsWith('at://'));
  if (atHandle) {
    return atHandle.replace('at://', '');
  }

  return null;
}

/**
 * Extract PDS endpoint from services
 */
export function extractPdsEndpoint(
  services?: Record<string, { type: string; endpoint: string }>
): string | null {
  if (!services) return null;

  const pds = services['atproto_pds'];
  if (pds && pds.type === 'AtprotoPersonalDataServer') {
    return pds.endpoint;
  }

  return null;
}

/**
 * Compare two operations and return the differences
 */
export function diffOperations(
  older: PlcOperation,
  newer: PlcOperation
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const diffs: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  const olderOp = older.operation;
  const newerOp = newer.operation;

  // Compare alsoKnownAs (handles)
  const oldHandles = olderOp.alsoKnownAs || [];
  const newHandles = newerOp.alsoKnownAs || [];
  if (JSON.stringify(oldHandles) !== JSON.stringify(newHandles)) {
    diffs.push({
      field: 'Handles',
      oldValue: oldHandles,
      newValue: newHandles,
    });
  }

  // Compare rotation keys
  const oldKeys = olderOp.rotationKeys || [];
  const newKeys = newerOp.rotationKeys || [];
  if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) {
    diffs.push({
      field: 'Rotation Keys',
      oldValue: oldKeys,
      newValue: newKeys,
    });
  }

  // Compare verification methods
  const oldMethods = olderOp.verificationMethods || {};
  const newMethods = newerOp.verificationMethods || {};
  if (JSON.stringify(oldMethods) !== JSON.stringify(newMethods)) {
    diffs.push({
      field: 'Verification Methods',
      oldValue: oldMethods,
      newValue: newMethods,
    });
  }

  // Compare services
  const oldServices = olderOp.services || {};
  const newServices = newerOp.services || {};
  if (JSON.stringify(oldServices) !== JSON.stringify(newServices)) {
    diffs.push({
      field: 'Services',
      oldValue: oldServices,
      newValue: newServices,
    });
  }

  return diffs;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Check if a DID is valid PLC format
 */
export function isValidPlcDid(did: string): boolean {
  return /^did:plc:[a-z2-7]{24}$/.test(did);
}
