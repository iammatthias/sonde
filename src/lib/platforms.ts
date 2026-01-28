// Platform Deep Links
// Maps lexicons to their corresponding platform URLs

import type { DID, Lexicon, Rkey } from "./types";

/** Platform information */
export interface Platform {
  name: string;
  baseUrl: string;
  icon?: string;
}

/** Known platforms in the ATProto ecosystem */
export const PLATFORMS: Record<string, Platform> = {
  "app.bsky": {
    name: "Bluesky",
    baseUrl: "https://bsky.app",
  },
  "com.whtwnd": {
    name: "WhiteWind",
    baseUrl: "https://whtwnd.com",
  },
  "fyi.unravel.frontpage": {
    name: "Frontpage",
    baseUrl: "https://frontpage.fyi",
  },
  "blue.flashes": {
    name: "Flashes",
    baseUrl: "https://flashes.blue",
  },
  "events.smokesignal": {
    name: "Smoke Signal",
    baseUrl: "https://smokesignal.events",
  },
  "link.pastesphere": {
    name: "PasteSphere",
    baseUrl: "https://pastesphere.link",
  },
};

/** Link generator function type */
type LinkGenerator = (did: DID, rkey?: Rkey) => string;

/**
 * Lexicon to URL mapping
 * Each entry maps a collection lexicon to a function that generates the platform URL
 */
const LEXICON_LINKS: Record<Lexicon, LinkGenerator> = {
  // Bluesky
  "app.bsky.actor.profile": (did) => `https://bsky.app/profile/${did}`,
  "app.bsky.feed.post": (did, rkey) => `https://bsky.app/profile/${did}/post/${rkey}`,
  "app.bsky.feed.generator": (did, rkey) => `https://bsky.app/profile/${did}/feed/${rkey}`,
  "app.bsky.graph.list": (did, rkey) => `https://bsky.app/profile/${did}/lists/${rkey}`,
  "app.bsky.graph.starterpack": (did, rkey) => `https://bsky.app/starter-pack/${did}/${rkey}`,
  "app.bsky.labeler.service": (did) => `https://bsky.app/profile/${did}`,

  // WhiteWind (blogging)
  "com.whtwnd.blog.entry": (did, rkey) => `https://whtwnd.com/${did}/${rkey}`,

  // Frontpage (link aggregator)
  "fyi.unravel.frontpage.post": (did, rkey) => `https://frontpage.fyi/post/${did}/${rkey}`,
  "fyi.unravel.frontpage.comment": (did, rkey) => `https://frontpage.fyi/comment/${did}/${rkey}`,

  // Flashes (photo sharing)
  "blue.flashes.photo": (did, rkey) => `https://flashes.blue/profile/${did}/photo/${rkey}`,
  "blue.flashes.album": (did, rkey) => `https://flashes.blue/profile/${did}/album/${rkey}`,

  // Smoke Signal (events)
  "events.smokesignal.calendar.event": (did, rkey) => `https://smokesignal.events/event/${did}/${rkey}`,

  // PasteSphere (pastebins)
  "link.pastesphere.snippet": (did, rkey) => `https://pastesphere.link/${did}/${rkey}`,
};

/**
 * Get the platform link for a record
 *
 * @param collection - The lexicon collection name
 * @param did - The DID of the record owner
 * @param rkey - The record key (optional for profile-level links)
 * @returns The platform URL or null if no mapping exists
 */
export function getPlatformLink(
  collection: Lexicon,
  did: DID,
  rkey?: Rkey
): string | null {
  const generator = LEXICON_LINKS[collection];
  if (!generator) {
    return null;
  }
  return generator(did, rkey);
}

/**
 * Get the platform info for a collection
 *
 * @param collection - The lexicon collection name
 * @returns Platform info or null if unknown
 */
export function getPlatformForCollection(collection: Lexicon): Platform | null {
  // Find the platform by matching the lexicon prefix
  for (const [prefix, platform] of Object.entries(PLATFORMS)) {
    if (collection.startsWith(prefix)) {
      return platform;
    }
  }
  return null;
}

/**
 * Get the profile link for an identity on a specific platform
 *
 * @param did - The DID of the user
 * @param platform - The platform key (e.g., "app.bsky")
 */
export function getProfileLink(did: DID, platform: string = "app.bsky"): string {
  switch (platform) {
    case "app.bsky":
      return `https://bsky.app/profile/${did}`;
    case "com.whtwnd":
      return `https://whtwnd.com/${did}`;
    case "fyi.unravel.frontpage":
      return `https://frontpage.fyi/profile/${did}`;
    case "blue.flashes":
      return `https://flashes.blue/profile/${did}`;
    default:
      return `https://bsky.app/profile/${did}`; // Default to Bluesky
  }
}

/**
 * Check if a collection has a known platform link
 */
export function hasPlatformLink(collection: Lexicon): boolean {
  return collection in LEXICON_LINKS;
}

/**
 * Get all supported collections for a platform
 */
export function getCollectionsForPlatform(platformPrefix: string): Lexicon[] {
  return Object.keys(LEXICON_LINKS).filter((lex) =>
    lex.startsWith(platformPrefix)
  ) as Lexicon[];
}
