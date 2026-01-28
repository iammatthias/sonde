<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();

    // Type the like record value
    interface LikeRecord {
        subject: {
            uri: string;
            cid: string;
        };
        createdAt: string;
    }

    const like = $derived(record.value as LikeRecord);

    function formatDate(iso: string): string {
        try {
            return new Date(iso).toLocaleDateString("en-US", {
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

    // Parse subject URI to extract DID
    function getDidFromUri(uri: string): string {
        const match = uri.match(/^at:\/\/([^/]+)/);
        return match ? match[1] : "";
    }

    // Get collection from URI
    function getCollectionFromUri(uri: string): string {
        const match = uri.match(/^at:\/\/[^/]+\/([^/]+)/);
        return match ? match[1].split(".").pop() || "" : "";
    }
</script>

<div class="like-record">
    <div class="like-icon">♥</div>
    <div class="like-content">
        <span class="like-action">Liked</span>
        <a
            href="/at/{like.subject.uri.replace('at://', '')}"
            class="like-subject"
        >
            <span class="subject-type"
                >{getCollectionFromUri(like.subject.uri)}</span
            >
            <span class="subject-uri mono">{like.subject.uri}</span>
        </a>
    </div>
    <time class="like-time">{formatDate(like.createdAt)}</time>
</div>

<style>
    .like-record {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
    }

    .like-icon {
        font-size: var(--text-sm);
        color: var(--color-error);
        flex-shrink: 0;
    }

    .like-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
    }

    .like-action {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .like-subject {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        padding: var(--space-1);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-subtle);
        border-radius: var(--radius-sm);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease;
    }

    .like-subject:hover {
        border-color: var(--color-accent);
    }

    .subject-type {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .subject-uri {
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .like-time {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        white-space: nowrap;
    }
</style>
