// OG Image Generation API
// Dynamic social card generation using Takumi

export const prerender = false;

import type { APIRoute } from "astro";
// Use WASM backend for Cloudflare Workers
import { ImageResponse } from "@takumi-rs/image-response/wasm";
import wasm from "@takumi-rs/wasm/takumi_wasm_bg.wasm";

import {
  HomeTemplate,
  ProfileTemplate,
  CollectionTemplate,
  RecordTemplate,
  SearchTemplate,
  ErrorTemplate,
} from "../../../lib/og-templates";
import { resolveIdentity, describeRepo } from "../../../lib/identity";
import { listRecords, getRecord } from "../../../lib/records";
import type { Lexicon, Rkey } from "../../../lib/types";

// OG Image dimensions
const WIDTH = 1200;
const HEIGHT = 630;

// Cloudflare ASSETS binding type
interface AssetsBinding {
  fetch: typeof fetch;
}

// Font cache
let fontsPromise: Promise<ArrayBuffer[]> | null = null;

async function loadFonts(baseUrl: string, assets?: AssetsBinding): Promise<ArrayBuffer[]> {
  if (!fontsPromise) {
    // Use ASSETS.fetch in Cloudflare Workers, regular fetch in dev
    const fetchFn = assets ? assets.fetch.bind(assets) : fetch;
    fontsPromise = Promise.all([
      fetchFn(`${baseUrl}/fonts/Inter-Regular.woff2`).then(r => r.arrayBuffer()),
      fetchFn(`${baseUrl}/fonts/Inter-SemiBold.woff2`).then(r => r.arrayBuffer()),
    ]);
  }
  return fontsPromise;
}

async function getImageOptions(baseUrl: string, assets?: AssetsBinding) {
  const [interRegular, interSemiBold] = await loadFonts(baseUrl, assets);

  return {
    width: WIDTH,
    height: HEIGHT,
    module: wasm,
    fonts: [
      {
        name: "Inter",
        data: interRegular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: "Inter",
        data: interSemiBold,
        weight: 600 as const,
        style: "normal" as const,
      },
    ],
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  };
}

export const GET: APIRoute = async ({ params, url, locals }) => {
  const path = params.path || "";
  const segments = path.split("/").filter(Boolean);

  // Get Cloudflare ASSETS binding if available (for font loading in Workers)
  const runtime = (locals as { runtime?: { env?: { ASSETS?: AssetsBinding } } }).runtime;
  const assets = runtime?.env?.ASSETS;

  // Load fonts and get image options
  const imageOptions = await getImageOptions(url.origin, assets);

  try {
    // Route: /api/og/ - Homepage
    if (segments.length === 0) {
      return new ImageResponse(HomeTemplate(), imageOptions);
    }

    // Route: /api/og/search?q=query
    if (segments[0] === "search") {
      const query = url.searchParams.get("q") || "";
      return new ImageResponse(
        SearchTemplate({ query }),
        imageOptions
      );
    }

    // Route: /api/og/error/:code
    if (segments[0] === "error") {
      const code = segments[1] || "404";
      const message = getErrorMessage(code);
      return new ImageResponse(
        ErrorTemplate({ code, message }),
        imageOptions
      );
    }

    // Route: /api/og/:identifier - Profile/DID
    if (segments.length === 1) {
      const identifier = segments[0];
      const profile = await fetchProfileData(identifier);
      return new ImageResponse(ProfileTemplate(profile), imageOptions);
    }

    // Route: /api/og/:identifier/:collection - Collection
    if (segments.length === 2) {
      const [identifier, collection] = segments;
      const collectionData = await fetchCollectionData(identifier, collection);
      return new ImageResponse(CollectionTemplate(collectionData), imageOptions);
    }

    // Route: /api/og/:identifier/:collection/:rkey - Record
    if (segments.length === 3) {
      const [identifier, collection, rkey] = segments;
      const recordData = await fetchRecordData(identifier, collection, rkey);
      return new ImageResponse(RecordTemplate(recordData), imageOptions);
    }

    // Fallback to 404
    return new ImageResponse(
      ErrorTemplate({ code: "404", message: "Page not found" }),
      imageOptions
    );
  } catch (error) {
    console.error("OG Image generation error:", error);
    return new ImageResponse(
      ErrorTemplate({
        code: "500",
        message: error instanceof Error ? error.message : "Internal error",
      }),
      imageOptions
    );
  }
};

// Helper functions

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "404": "Record not found in the atmosphere",
    "500": "Something went wrong",
    "403": "Access denied",
    "400": "Invalid request",
  };
  return messages[code] || "An error occurred";
}

async function fetchProfileData(identifier: string) {
  try {
    const identity = await resolveIdentity(identifier);

    // Fetch repo description to get collections
    const repoDesc = await describeRepo(identity.pdsEndpoint, identity.did);

    // Fetch profile record to get avatar
    let avatarUrl: string | undefined;
    try {
      const profileRecord = await getRecord(
        identity.pdsEndpoint,
        identity.did,
        "app.bsky.actor.profile" as Lexicon,
        "self" as Rkey
      );
      const profileValue = profileRecord.value as Record<string, unknown>;
      const avatarBlob = profileValue?.avatar as { ref?: { $link?: string } } | undefined;
      if (avatarBlob?.ref?.$link) {
        avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${identity.did}/${avatarBlob.ref.$link}@jpeg`;
      }
    } catch {
      // Avatar fetch failed, continue without it
    }

    // Get collection names only (ATProto doesn't have count API)
    const collections = repoDesc.collections.slice(0, 5);

    return {
      handle: identity.handle || identifier,
      did: identity.did,
      pds: new URL(identity.pdsEndpoint).hostname,
      avatar: avatarUrl,
      collections,
      collectionCount: repoDesc.collections.length,
    };
  } catch (err) {
    console.error("fetchProfileData error:", err);
    return {
      handle: identifier,
      did: identifier.startsWith("did:") ? identifier : "Unknown",
      pds: "Unknown",
      collections: [],
      collectionCount: 0,
    };
  }
}

async function fetchCollectionData(identifier: string, collection: string) {
  try {
    const identity = await resolveIdentity(identifier);
    const records = await listRecords(
      identity.pdsEndpoint,
      identity.did,
      collection as Lexicon,
      { limit: 5 }
    );

    const hasMore = !!records.cursor;
    const fetchedCount = records.records?.length || 0;

    return {
      handle: identity.handle || identifier,
      nsid: collection,
      description: getCollectionDescription(collection),
      recordCount: fetchedCount,
      hasMore,
      recentRecords: (records.records || []).slice(0, 3).map((r) => {
        const value = r.value as Record<string, unknown>;
        const rkey = r.uri.split("/").pop() || "";
        return {
          rkey,
          preview: getRecordPreview(value, collection),
          createdAt: extractCreatedAt(value),
        };
      }),
    };
  } catch (err) {
    console.error("fetchCollectionData error:", err);
    return {
      handle: identifier,
      nsid: collection,
      description: getCollectionDescription(collection),
      recordCount: 0,
      hasMore: false,
      recentRecords: [],
    };
  }
}

async function fetchRecordData(
  identifier: string,
  collection: string,
  rkey: string
) {
  try {
    const identity = await resolveIdentity(identifier);
    const record = await getRecord(
      identity.pdsEndpoint,
      identity.did,
      collection as Lexicon,
      rkey as Rkey
    );

    const value = record.value as Record<string, unknown>;

    return {
      handle: identity.handle || identifier,
      nsid: collection,
      rkey,
      atUri: `at://${identity.did}/${collection}/${rkey}`,
      cid: record.cid || "",
      createdAt: extractCreatedAt(value),
      recordPreview: value || {},
    };
  } catch (err) {
    console.error("fetchRecordData error:", err);
    return {
      handle: identifier,
      nsid: collection,
      rkey,
      atUri: `at://${identifier}/${collection}/${rkey}`,
      cid: "",
      createdAt: "",
      recordPreview: {},
    };
  }
}

// Smart preview based on record type
function getRecordPreview(value: Record<string, unknown>, nsid: string): string {
  // Posts have text
  if (value.text && typeof value.text === "string") {
    return value.text.slice(0, 50);
  }

  // Likes/reposts reference a subject
  if (value.subject && typeof value.subject === "object") {
    const subject = value.subject as { uri?: string };
    if (subject.uri) {
      const rkey = subject.uri.split("/").pop();
      return `→ ${rkey}`;
    }
  }

  // Follows have a subject DID
  if (nsid.includes("follow") && value.subject && typeof value.subject === "string") {
    return `→ ${value.subject.slice(0, 25)}...`;
  }

  // Blocks
  if (nsid.includes("block") && value.subject && typeof value.subject === "string") {
    return `→ ${value.subject.slice(0, 25)}...`;
  }

  // Profile
  if (nsid.includes("profile")) {
    if (value.displayName) return value.displayName as string;
    if (value.description) return (value.description as string).slice(0, 50);
  }

  // Generic fallback
  const json = JSON.stringify(value);
  if (json.length > 40) {
    return json.slice(0, 37) + "...";
  }
  return json;
}

// Extract createdAt from record value
function extractCreatedAt(value: Record<string, unknown>): string {
  if (value.createdAt && typeof value.createdAt === "string") {
    // Format the date nicely
    try {
      const date = new Date(value.createdAt);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return value.createdAt;
    }
  }
  return "";
}

function getCollectionDescription(nsid: string): string {
  const descriptions: Record<string, string> = {
    "app.bsky.feed.post": "Bluesky posts and threads",
    "app.bsky.feed.like": "Liked posts",
    "app.bsky.feed.repost": "Reposted content",
    "app.bsky.graph.follow": "Following relationships",
    "app.bsky.graph.block": "Blocked accounts",
    "app.bsky.graph.list": "Lists",
    "app.bsky.graph.listitem": "List items",
    "app.bsky.actor.profile": "Profile information",
    "app.bsky.feed.threadgate": "Thread gates",
    "app.bsky.feed.generator": "Feed generators",
    "app.bsky.labeler.service": "Labeler service",
  };

  // Extract the last part of unknown NSIDs for cleaner display
  if (!descriptions[nsid]) {
    const parts = nsid.split(".");
    return parts[parts.length - 1] + " records";
  }

  return descriptions[nsid];
}
