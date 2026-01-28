// Label API Client
// For querying moderation labels and labeler services

import type { Label, LabelerInfo, KnownLabeler, DID } from "./types";

/** Public API endpoint for labeler queries */
export const PUBLIC_API = "https://public.api.bsky.app";

/** Known public labelers */
export const KNOWN_LABELERS: KnownLabeler[] = [
  {
    did: "did:plc:ar7c4by46qjdydhdevvrndac" as DID,
    name: "Bluesky Moderation",
  },
  {
    did: "did:plc:e4elbtctnfqocyfcml6h2lf7" as DID,
    name: "AT Protocol PDS Admins",
  },
  {
    did: "did:plc:xgjcuk2q6adgysjkydcnx75t" as DID,
    name: "Anti-Alf Aktion",
  },
  {
    did: "did:plc:5t6gsjybntdrpce42v3re7ce" as DID,
    name: "Aegis",
  },
  {
    did: "did:plc:jcoy7v3a2t4rcfdh6i4kza25" as DID,
    name: "XBlock",
  },
];

/** Label severity CSS class names for styling */
export const SEVERITY_CLASSES = {
  inform: "severity-inform",
  alert: "severity-alert",
  none: "severity-none",
};

/** Blur type descriptions */
export const BLUR_DESCRIPTIONS = {
  content: "Entire content is hidden",
  media: "Only media is hidden",
  none: "Content is visible",
};

/**
 * Query labels by subject (DID or AT-URI)
 * Note: The API requires at least one source DID. If none provided,
 * we default to known labelers.
 */
export async function queryLabels(
  subjects: string[],
  options: {
    sources?: string[];
    limit?: number;
    cursor?: string;
  } = {},
): Promise<{ labels: Label[]; cursor?: string }> {
  const params = new URLSearchParams();

  for (const subject of subjects) {
    params.append("uriPatterns", subject);
  }

  // API requires sources - use known labelers if none provided
  const sources =
    options.sources && options.sources.length > 0
      ? options.sources
      : KNOWN_LABELERS.map((l) => l.did);

  for (const source of sources) {
    params.append("sources", source);
  }

  if (options.limit) {
    params.set("limit", options.limit.toString());
  }

  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  const url = `${PUBLIC_API}/xrpc/com.atproto.label.queryLabels?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to query labels: ${response.status}`);
  }

  const data = await response.json();
  return {
    labels: data.labels || [],
    cursor: data.cursor,
  };
}

/**
 * Get labeler service information
 */
export async function getLabelerServices(
  dids: string[],
  detailed: boolean = true,
): Promise<LabelerInfo[]> {
  const params = new URLSearchParams();

  for (const did of dids) {
    params.append("dids", did);
  }

  if (detailed) {
    params.set("detailed", "true");
  }

  const url = `${PUBLIC_API}/xrpc/app.bsky.labeler.getServices?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get labeler services: ${response.status}`);
  }

  const data = await response.json();
  return (data.views || []).map((view: unknown) => transformLabelerView(view));
}

/**
 * Transform API labeler view to our LabelerInfo type
 */
function transformLabelerView(view: unknown): LabelerInfo {
  const v = view as {
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
      labelValueDefinitions?: Array<{
        identifier: string;
        severity: string;
        blurs: string;
        defaultSetting?: string;
        adultOnly?: boolean;
        locales: Array<{ lang: string; name: string; description: string }>;
      }>;
    };
    likeCount?: number;
    indexedAt: string;
  };

  return {
    uri: v.uri,
    cid: v.cid,
    creator: {
      did: v.creator.did,
      handle: v.creator.handle,
      displayName: v.creator.displayName,
      avatar: v.creator.avatar,
    },
    policies: {
      labelValues: v.policies.labelValues || [],
      labelValueDefinitions: v.policies.labelValueDefinitions?.map((def) => ({
        identifier: def.identifier,
        severity: def.severity as "inform" | "alert" | "none",
        blurs: def.blurs as "content" | "media" | "none",
        defaultSetting: def.defaultSetting as
          | "ignore"
          | "warn"
          | "hide"
          | undefined,
        adultOnly: def.adultOnly,
        locales: def.locales,
      })),
    },
    likeCount: v.likeCount,
    indexedAt: v.indexedAt,
  };
}

/**
 * Format a label value for display
 */
export function formatLabelValue(val: string): string {
  // Remove common prefixes and format
  const cleaned = val
    .replace(/^!/, "") // Remove negation prefix
    .replace(/-/g, " ")
    .replace(/_/g, " ");

  // Title case
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Check if a label is negated (removed)
 */
export function isNegatedLabel(label: Label): boolean {
  return label.neg === true;
}

/**
 * Format label timestamp
 */
export function formatLabelTimestamp(cts: string): string {
  const date = new Date(cts);
  return date.toLocaleString();
}

/**
 * Get localized name for a label value definition
 */
export function getLocalizedName(
  definition: {
    locales: Array<{ lang: string; name: string; description: string }>;
  },
  lang: string = "en",
): { name: string; description: string } {
  const locale =
    definition.locales.find((l) => l.lang === lang) || definition.locales[0];
  return {
    name: locale?.name || "Unknown",
    description: locale?.description || "",
  };
}

/**
 * Group labels by source (labeler)
 */
export function groupLabelsBySource(labels: Label[]): Map<string, Label[]> {
  const groups = new Map<string, Label[]>();

  for (const label of labels) {
    const existing = groups.get(label.src) || [];
    existing.push(label);
    groups.set(label.src, existing);
  }

  return groups;
}

/**
 * Group labels by subject
 */
export function groupLabelsBySubject(labels: Label[]): Map<string, Label[]> {
  const groups = new Map<string, Label[]>();

  for (const label of labels) {
    const existing = groups.get(label.uri) || [];
    existing.push(label);
    groups.set(label.uri, existing);
  }

  return groups;
}

/**
 * Check if a string looks like a DID
 */
export function isDid(str: string): boolean {
  return str.startsWith("did:");
}

/**
 * Check if a string looks like an AT-URI
 */
export function isAtUri(str: string): boolean {
  return str.startsWith("at://");
}

/**
 * Validate subject input
 */
export function validateSubject(input: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: "Please enter a subject" };
  }

  if (!isDid(trimmed) && !isAtUri(trimmed)) {
    return {
      valid: false,
      error: "Subject must be a DID (did:...) or AT-URI (at://...)",
    };
  }

  return { valid: true };
}
