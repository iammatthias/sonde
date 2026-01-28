// Identity resolution for ATProto
// Handles: handle → DID → DID Document → PDS endpoint

import type { DID, DidDocument, ResolvedIdentity, Service } from "./types";
import { cacheIdentity, getCachedIdentity } from "./cache";
import { memoizeAsync } from "./memo";

const PUBLIC_API = "https://public.api.bsky.app";
const PLC_DIRECTORY = "https://plc.directory";

// In-flight request deduplication for identity resolution
const inflightResolutions = new Map<string, Promise<ResolvedIdentity>>();

/** Check if a string looks like a DID */
export function isDid(identifier: string): identifier is DID {
  return identifier.startsWith("did:");
}

/** Check if a string looks like a handle (domain-like) */
export function isHandle(identifier: string): boolean {
  // Handles are domain-like: alice.bsky.social, bob.example.com
  // Not starting with did: and containing at least one dot
  return (
    !isDid(identifier) &&
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(
      identifier,
    )
  );
}

/** Normalize identifier - remove @ prefix, lowercase */
export function normalizeIdentifier(identifier: string): string {
  return identifier.replace(/^@/, "").toLowerCase().trim();
}

/**
 * Resolve any identifier (handle or DID) to a DID.
 * Returns the DID as-is if already a DID, or resolves handle to DID.
 */
export async function resolveToDidString(identifier: string): Promise<string> {
  const normalized = normalizeIdentifier(identifier);

  if (isDid(normalized)) {
    return normalized;
  }

  if (isHandle(normalized)) {
    return await resolveHandle(normalized);
  }

  throw new Error(`Invalid identifier: must be a DID or handle`);
}

/** Resolve a handle to a DID using the public API */
export async function resolveHandle(handle: string): Promise<DID> {
  const normalized = normalizeIdentifier(handle);

  const response = await fetch(
    `${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(normalized)}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to resolve handle: ${response.status}`,
    );
  }

  const data = await response.json();
  return data.did as DID;
}

/** Fetch DID document from PLC directory or did:web */
export async function resolveDid(did: DID): Promise<DidDocument> {
  if (did.startsWith("did:plc:")) {
    // PLC directory lookup
    const response = await fetch(`${PLC_DIRECTORY}/${did}`);
    if (!response.ok) {
      throw new Error(`Failed to resolve DID: ${response.status}`);
    }
    return response.json();
  } else if (did.startsWith("did:web:")) {
    // did:web resolution - domain is in the DID
    const domain = did.replace("did:web:", "").replace(/%3A/g, ":");
    const response = await fetch(`https://${domain}/.well-known/did.json`);
    if (!response.ok) {
      throw new Error(`Failed to resolve did:web: ${response.status}`);
    }
    return response.json();
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
}

/** Extract PDS endpoint from DID document */
export function getPdsEndpoint(didDoc: DidDocument): string {
  const pdsService = didDoc.service?.find(
    (s: Service) =>
      s.type === "AtprotoPersonalDataServer" || s.id === "#atproto_pds",
  );

  if (!pdsService) {
    throw new Error("No PDS service found in DID document");
  }

  return pdsService.serviceEndpoint;
}

/** Extract handle from DID document alsoKnownAs */
export function getHandleFromDidDoc(didDoc: DidDocument): string | null {
  const atHandle = didDoc.alsoKnownAs?.find((aka) => aka.startsWith("at://"));
  if (atHandle) {
    // at://handle.example.com -> handle.example.com
    return atHandle.replace("at://", "");
  }
  return null;
}

/** Internal identity resolution logic */
async function resolveIdentityInternal(
  normalized: string,
): Promise<ResolvedIdentity> {
  let did: DID;
  let handle: string;

  // Step 1: Get the DID
  if (isDid(normalized)) {
    did = normalized as DID;
  } else {
    did = await resolveHandle(normalized);
  }

  // Step 2: Get the DID document
  const didDocument = await resolveDid(did);

  // Step 3: Extract handle from DID document (authoritative)
  const docHandle = getHandleFromDidDoc(didDocument);
  handle = docHandle || normalized;

  // Step 4: Get PDS endpoint
  const pdsEndpoint = getPdsEndpoint(didDocument);

  const resolved: ResolvedIdentity = {
    handle,
    did,
    pdsEndpoint,
    didDocument,
    resolvedAt: Date.now(),
  };

  // Cache the result
  cacheIdentity(normalized, resolved);

  return resolved;
}

/** Full identity resolution - takes handle or DID, returns everything
 * Deduplicates in-flight requests and uses caching
 */
export async function resolveIdentity(
  identifier: string,
): Promise<ResolvedIdentity> {
  const normalized = normalizeIdentifier(identifier);

  // Check cache first
  const cached = getCachedIdentity(normalized);
  if (cached) {
    return cached;
  }

  // Check for in-flight request (deduplication)
  const inflight = inflightResolutions.get(normalized);
  if (inflight) {
    return inflight;
  }

  // Start new resolution
  const promise = resolveIdentityInternal(normalized).finally(() => {
    inflightResolutions.delete(normalized);
  });

  inflightResolutions.set(normalized, promise);
  return promise;
}

/** Get repo description from PDS */
export async function describeRepo(
  pdsEndpoint: string,
  did: DID,
): Promise<{
  handle: string;
  did: DID;
  collections: string[];
}> {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Failed to describe repo: ${response.status}`,
    );
  }

  const data = await response.json();
  return {
    handle: data.handle,
    did: data.did,
    collections: data.collections || [],
  };
}
