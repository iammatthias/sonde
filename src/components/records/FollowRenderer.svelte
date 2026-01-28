<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();

    // Type the follow record value
    interface FollowRecord {
        subject: string; // DID of followed account
        createdAt: string;
    }

    const follow = $derived(record.value as FollowRecord);

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

    // Format DID for display
    function formatDid(did: string): string {
        if (did.length > 30) {
            return did.slice(0, 20) + "..." + did.slice(-6);
        }
        return did;
    }
</script>

<div class="follow-record">
    <div class="follow-icon">+</div>
    <div class="follow-content">
        <span class="follow-action">Following</span>
        <a href="/at/{follow.subject}" class="follow-subject">
            <span class="subject-label">Account</span>
            <span class="subject-did mono">{follow.subject}</span>
        </a>
    </div>
    <time class="follow-time">{formatDate(follow.createdAt)}</time>
</div>

<style>
    .follow-record {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
    }

    .follow-icon {
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        color: var(--color-accent-text);
        flex-shrink: 0;
        width: 16px;
        text-align: center;
    }

    .follow-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
    }

    .follow-action {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .follow-subject {
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

    .follow-subject:hover {
        border-color: var(--color-accent);
    }

    .subject-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .subject-did {
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .follow-time {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        white-space: nowrap;
    }
</style>
