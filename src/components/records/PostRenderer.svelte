<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";
    import { parseFacets, type TextSegment } from "../../lib/facets";
    import { getBlobUrl } from "../../lib/records";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();

    // Type the post record value
    interface PostRecord {
        text: string;
        createdAt: string;
        facets?: any[];
        reply?: {
            root: { uri: string; cid: string };
            parent: { uri: string; cid: string };
        };
        embed?: {
            $type: string;
            images?: Array<{
                alt: string;
                image: { ref: { $link: string }; mimeType: string };
                aspectRatio?: { width: number; height: number };
            }>;
            external?: {
                uri: string;
                title: string;
                description: string;
                thumb?: { ref: { $link: string }; mimeType: string };
            };
            record?: {
                uri: string;
                cid: string;
            };
        };
        langs?: string[];
        labels?: any;
    }

    const post = $derived(record.value as PostRecord);
    const segments = $derived(parseFacets(post.text, post.facets));

    // Format timestamp
    function formatDate(iso: string): string {
        try {
            const date = new Date(iso);
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch {
            return iso;
        }
    }

    // Extract DID from AT-URI for links
    function getDidFromUri(uri: string): string {
        const match = uri.match(/^at:\/\/([^/]+)/);
        return match ? match[1] : uri;
    }

    // Get image URL from blob ref
    function getImageUrl(ref: string): string {
        return getBlobUrl(pdsEndpoint, did, ref);
    }

    // Determine embed type
    const embedType = $derived.by(() => {
        if (!post.embed) return null;
        const type = post.embed.$type;
        if (type?.includes("images")) return "images";
        if (type?.includes("external")) return "external";
        if (type?.includes("record")) return "quote";
        if (type?.includes("recordWithMedia")) return "quote-with-media";
        return "unknown";
    });
</script>

<article class="post">
    <!-- Reply context -->
    {#if post.reply}
        <div class="reply-context">
            <span class="reply-icon">↩</span>
            <span class="reply-label">Replying to</span>
            <a
                href="/at/{getDidFromUri(post.reply.parent.uri)}"
                class="reply-link mono"
            >
                {getDidFromUri(post.reply.parent.uri)}
            </a>
        </div>
    {/if}

    <!-- Post text with facets -->
    <div class="post-text">
        {#each segments as segment}
            {#if segment.mention}
                <a href="/at/{segment.mention.did}" class="mention">
                    {segment.text}
                </a>
            {:else if segment.link}
                <a
                    href={segment.link.uri}
                    class="link"
                    target="_blank"
                    rel="noopener"
                >
                    {segment.text}
                </a>
            {:else if segment.tag}
                <span class="hashtag">#{segment.tag}</span>
            {:else}
                {segment.text}
            {/if}
        {/each}
    </div>

    <!-- Embeds -->
    {#if post.embed}
        <div class="embed">
            {#if embedType === "images" && post.embed.images}
                <div
                    class="image-grid"
                    class:single={post.embed.images.length === 1}
                >
                    {#each post.embed.images as img}
                        <figure class="image-item">
                            <img
                                src={getImageUrl(img.image.ref.$link)}
                                alt={img.alt || "Embedded image"}
                                loading="lazy"
                            />
                            {#if img.alt}
                                <figcaption class="image-alt">
                                    {img.alt}
                                </figcaption>
                            {/if}
                        </figure>
                    {/each}
                </div>
            {:else if embedType === "external" && post.embed.external}
                <a
                    href={post.embed.external.uri}
                    class="link-card"
                    target="_blank"
                    rel="noopener"
                >
                    {#if post.embed.external.thumb}
                        <img
                            src={getImageUrl(
                                post.embed.external.thumb.ref.$link,
                            )}
                            alt=""
                            class="link-thumb"
                            loading="lazy"
                        />
                    {/if}
                    <div class="link-info">
                        <span class="link-title"
                            >{post.embed.external.title}</span
                        >
                        <span class="link-desc"
                            >{post.embed.external.description}</span
                        >
                        <span class="link-domain mono">
                            {new URL(post.embed.external.uri).hostname}
                        </span>
                    </div>
                </a>
            {:else if embedType === "quote" && post.embed.record}
                <a
                    href="/at/{post.embed.record.uri.replace('at://', '')}"
                    class="quote-card"
                >
                    <span class="quote-label">Quoted post</span>
                    <span class="quote-uri mono">{post.embed.record.uri}</span>
                </a>
            {:else}
                <div class="embed-fallback">
                    <span class="embed-type">{post.embed.$type}</span>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Metadata -->
    <footer class="post-meta">
        <time datetime={post.createdAt}>{formatDate(post.createdAt)}</time>
        {#if post.langs && post.langs.length > 0}
            <span class="lang-badge">{post.langs.join(", ")}</span>
        {/if}
    </footer>
</article>

<style>
    .post {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    /* Reply context */
    .reply-context {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .reply-icon {
        font-size: var(--text-sm);
    }

    .reply-label {
        color: var(--color-text-3);
    }

    .reply-link {
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
    }

    /* Post text */
    .post-text {
        font-size: var(--text-base);
        line-height: var(--leading-normal);
        white-space: pre-wrap;
        word-break: break-word;
    }

    .mention {
        color: var(--color-accent-text);
        font-weight: var(--weight-medium);
    }

    .link {
        color: var(--color-accent-text);
        word-break: break-all;
    }

    .hashtag {
        color: var(--color-accent-text);
        font-weight: var(--weight-medium);
    }

    /* Embeds */
    .embed {
        margin-top: var(--space-1);
    }

    .image-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-1);
        border-radius: var(--radius-md);
        overflow: hidden;
    }

    .image-grid.single {
        grid-template-columns: 1fr;
    }

    .image-item {
        margin: 0;
        position: relative;
    }

    .image-item img {
        width: 100%;
        height: auto;
        max-height: 300px;
        object-fit: cover;
        display: block;
    }

    .image-alt {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-on-dark);
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .image-item:hover .image-alt {
        opacity: 1;
    }

    .link-card {
        display: flex;
        gap: var(--space-2);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease;
    }

    .link-card:hover {
        border-color: var(--color-accent);
    }

    .link-thumb {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
    }

    .link-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        min-width: 0;
    }

    .link-title {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .link-desc {
        font-size: var(--text-xs);
        color: var(--color-text-2);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .link-domain {
        font-size: var(--text-2xs);
        color: var(--color-text-3);
    }

    .quote-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease;
    }

    .quote-card:hover {
        border-color: var(--color-accent);
    }

    .quote-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .quote-uri {
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .embed-fallback {
        padding: var(--space-1);
        background: var(--color-surface-raised);
        border-radius: var(--radius-sm);
    }

    .embed-type {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    /* Post metadata */
    .post-meta {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        padding-top: var(--space-1);
        border-top: var(--border-weight) solid var(--color-border-subtle);
    }

    .lang-badge {
        padding: var(--space-px) var(--space-0);
        font-size: var(--text-2xs);
        font-family: var(--font-mono);
        background: var(--warm-grey-100);
        border-radius: var(--radius-sm);
        text-transform: uppercase;
    }
</style>
