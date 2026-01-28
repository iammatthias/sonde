/**
 * Parse Bluesky post facets into renderable text segments.
 * Facets are byte-indexed rich text features (mentions, links, hashtags).
 */

export interface FacetFeature {
    $type: string;
    uri?: string;
    did?: string;
    tag?: string;
}

export interface Facet {
    index: {
        byteStart: number;
        byteEnd: number;
    };
    features: FacetFeature[];
}

export interface TextSegment {
    text: string;
    mention?: { did: string };
    link?: { uri: string };
    tag?: string;
}

/**
 * Parse text with facets into renderable segments.
 * Handles byte-indexed facets correctly with UTF-8 encoding.
 */
export function parseFacets(text: string, facets?: Facet[]): TextSegment[] {
    if (!facets || facets.length === 0) {
        return [{ text }];
    }

    // Convert string to bytes for proper indexing
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const bytes = encoder.encode(text);

    // Sort facets by start position
    const sortedFacets = [...facets].sort(
        (a, b) => a.index.byteStart - b.index.byteStart
    );

    const segments: TextSegment[] = [];
    let lastEnd = 0;

    for (const facet of sortedFacets) {
        const { byteStart, byteEnd } = facet.index;

        // Skip invalid facets
        if (byteStart < 0 || byteEnd > bytes.length || byteStart >= byteEnd) {
            continue;
        }

        // Add plain text before this facet
        if (byteStart > lastEnd) {
            const plainBytes = bytes.slice(lastEnd, byteStart);
            segments.push({ text: decoder.decode(plainBytes) });
        }

        // Get the faceted text
        const facetBytes = bytes.slice(byteStart, byteEnd);
        const facetText = decoder.decode(facetBytes);

        // Process facet features
        const segment: TextSegment = { text: facetText };

        for (const feature of facet.features) {
            if (feature.$type === "app.bsky.richtext.facet#mention" && feature.did) {
                segment.mention = { did: feature.did };
            } else if (feature.$type === "app.bsky.richtext.facet#link" && feature.uri) {
                segment.link = { uri: feature.uri };
            } else if (feature.$type === "app.bsky.richtext.facet#tag" && feature.tag) {
                segment.tag = feature.tag;
            }
        }

        segments.push(segment);
        lastEnd = byteEnd;
    }

    // Add remaining plain text
    if (lastEnd < bytes.length) {
        const remainingBytes = bytes.slice(lastEnd);
        segments.push({ text: decoder.decode(remainingBytes) });
    }

    return segments;
}

/**
 * Extract handle from mention DID for display.
 * Returns shortened DID if handle resolution not available.
 */
export function formatMentionDisplay(did: string): string {
    // Truncate DID for display: did:plc:abc123... -> did:plc:abc1...
    if (did.length > 20) {
        return did.slice(0, 16) + "...";
    }
    return did;
}

/**
 * Format external link for display.
 * Shows domain only for cleaner UI.
 */
export function formatLinkDisplay(uri: string): string {
    try {
        const url = new URL(uri);
        return url.hostname.replace(/^www\./, "");
    } catch {
        // If URL parsing fails, truncate
        return uri.length > 30 ? uri.slice(0, 27) + "..." : uri;
    }
}
