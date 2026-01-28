// ATProto Types for PDScan

/** Decentralized Identifier */
export type DID = `did:${string}:${string}`;

/** AT Protocol URI - at://did/collection/rkey */
export type AtUri = `at://${string}`;

/** Content Identifier (IPFS-style hash) */
export type CID = string;

/** Record Key - usually a TID (timestamp identifier) */
export type Rkey = string;

/** Lexicon namespace (e.g., app.bsky.feed.post) */
export type Lexicon = string;

/** Resolved identity information */
export interface ResolvedIdentity {
  handle: string;
  did: DID;
  pdsEndpoint: string;
  didDocument: DidDocument;
  resolvedAt: number;
}

/** DID Document structure */
export interface DidDocument {
  "@context": string[];
  id: DID;
  alsoKnownAs?: string[];
  verificationMethod?: VerificationMethod[];
  service?: Service[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/** Repository description from describeRepo */
export interface RepoDescription {
  handle: string;
  did: DID;
  didDoc: DidDocument;
  collections: Lexicon[];
  handleIsCorrect: boolean;
}

/** A single record from the repo */
export interface RepoRecord<T = unknown> {
  uri: AtUri;
  cid: CID;
  value: T;
}

/** Paginated list of records */
export interface RecordList<T = unknown> {
  records: RepoRecord<T>[];
  cursor?: string;
}

/** Blob reference in a record */
export interface BlobRef {
  $type: "blob";
  ref: {
    $link: CID;
  };
  mimeType: string;
  size: number;
}

/** Strong reference to another record */
export interface StrongRef {
  uri: AtUri;
  cid: CID;
}

/** Parsed AT-URI components */
export interface ParsedAtUri {
  did: DID;
  collection: Lexicon;
  rkey: Rkey;
}

/** Cache entry with TTL */
export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

/** Network stats from bsky-stats API */
export interface NetworkStats {
  total_users: number;
  total_posts: number;
  total_follows: number;
  total_likes: number;
  users_growth_rate_per_second: number;
  last_update_time: string;
  next_update_time: string;
}

/** Encoding types we can detect and decode */
export type EncodingType =
  | "at-uri"
  | "did"
  | "cid"
  | "blob-ref"
  | "strong-ref"
  | "tid"
  | "datetime"
  | "base64"
  | "bytes"
  | "unknown";

/** Decoded value with metadata */
export interface DecodedValue {
  original: unknown;
  type: EncodingType;
  decoded: unknown;
  displayValue: string;
  isNavigable: boolean;
  navigateTo?: string;
}

/** View mode for record display */
export type ViewMode = "raw" | "decoded" | "pretty";

/** Loading state for async operations */
export interface LoadingState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

// ============================================
// Jetstream Types
// ============================================

/** Jetstream event kinds */
export type JetstreamEventKind = "commit" | "identity" | "account";

/** Jetstream commit operation types */
export type JetstreamOperation = "create" | "update" | "delete";

/** Jetstream commit data */
export interface JetstreamCommit {
  rev: string;
  operation: JetstreamOperation;
  collection: string;
  rkey: string;
  record?: unknown;
  cid?: string;
}

/** Jetstream identity event data */
export interface JetstreamIdentity {
  did: string;
  handle: string;
}

/** Jetstream account event data */
export interface JetstreamAccount {
  active: boolean;
  status?: string;
}

/** Jetstream event structure */
export interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: JetstreamEventKind;
  commit?: JetstreamCommit;
  identity?: JetstreamIdentity;
  account?: JetstreamAccount;
}

/** Jetstream connection options */
export interface JetstreamOptions {
  wantedCollections?: string[];
  wantedDids?: string[];
  cursor?: number;
}

// ============================================
// Firehose Types
// ============================================

/** Firehose frame operation types */
export type FirehoseOp = 1 | -1; // 1 = message, -1 = error

/** Firehose frame structure */
export interface FirehoseFrame {
  op: FirehoseOp;
  t?: string; // message type: '#commit', '#handle', '#identity', etc.
  body: unknown;
}

/** Firehose commit operation */
export interface FirehoseCommitOp {
  action: "create" | "update" | "delete";
  path: string; // collection/rkey
  cid?: { $link: string } | null;
}

/** Firehose commit event body */
export interface FirehoseCommitEvent {
  repo: string; // DID
  rev: string;
  seq: number;
  since: string | null;
  time: string;
  tooBig: boolean;
  rebase: boolean;
  blocks: Uint8Array; // CAR file bytes
  ops: FirehoseCommitOp[];
}

// ============================================
// Label Types
// ============================================

/** ATProto label structure */
export interface Label {
  ver?: number;
  src: string; // labeler DID
  uri: string; // subject AT-URI or DID
  cid?: string;
  val: string; // label value
  neg?: boolean; // negation
  cts: string; // created timestamp
  exp?: string; // expiration
  sig?: Uint8Array;
}

/** Label value definition */
export interface LabelValueDefinition {
  identifier: string;
  severity: "inform" | "alert" | "none";
  blurs: "content" | "media" | "none";
  defaultSetting?: "ignore" | "warn" | "hide";
  adultOnly?: boolean;
  locales: Array<{ lang: string; name: string; description: string }>;
}

/** Labeler service information */
export interface LabelerInfo {
  uri: string;
  cid: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  policies: {
    labelValues: string[];
    labelValueDefinitions?: LabelValueDefinition[];
  };
  likeCount?: number;
  indexedAt: string;
}

/** Known labeler entry */
export interface KnownLabeler {
  did: DID;
  name: string;
}

// ============================================
// CAR File Types
// ============================================

/** Parsed block from a CAR file */
export interface ParsedBlock {
  cid: string;
  bytes: Uint8Array;
  decoded: unknown;
}

/** Extracted record from a CAR file */
export interface ExtractedRecord {
  collection: string;
  rkey: string;
  cid: string;
  value: unknown;
}

/** Parsed CAR file structure */
export interface ParsedCar {
  roots: string[];
  blocks: ParsedBlock[];
  records: ExtractedRecord[];
}

// ============================================
// PLC Directory Types
// ============================================

/** PLC operation types */
export type PlcOperationType = "plc_operation" | "plc_tombstone" | "create";

/** PLC operation data */
export interface PlcOperationData {
  type: PlcOperationType;
  sig: string;
  prev: string | null;
  services?: Record<string, { type: string; endpoint: string }>;
  alsoKnownAs?: string[];
  rotationKeys?: string[];
  verificationMethods?: Record<string, string>;
}

/** PLC operation log entry */
export interface PlcOperation {
  did: string;
  operation: PlcOperationData;
  cid: string;
  nullified: boolean;
  createdAt: string;
}

/** PLC export entry (from /export endpoint) */
export interface PlcExportEntry {
  did: string;
  operation: PlcOperationData;
  cid: string;
  nullified: boolean;
  createdAt: string;
}
