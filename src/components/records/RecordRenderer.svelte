<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";
    import GenericRenderer from "./GenericRenderer.svelte";
    import PostRenderer from "./PostRenderer.svelte";
    import ProfileRenderer from "./ProfileRenderer.svelte";
    import LikeRenderer from "./LikeRenderer.svelte";
    import RepostRenderer from "./RepostRenderer.svelte";
    import FollowRenderer from "./FollowRenderer.svelte";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
        showRawToggle?: boolean;
    }

    let { record, pdsEndpoint, did, showRawToggle = true }: Props = $props();

    // Extract collection type from URI: at://did/collection/rkey
    function getCollectionFromUri(uri: string): string | null {
        const match = uri.match(/^at:\/\/[^/]+\/([^/]+)/);
        return match ? match[1] : null;
    }

    // Map collection types to renderers
    const RENDERERS: Record<string, typeof GenericRenderer> = {
        "app.bsky.feed.post": PostRenderer,
        "app.bsky.actor.profile": ProfileRenderer,
        "app.bsky.feed.like": LikeRenderer,
        "app.bsky.feed.repost": RepostRenderer,
        "app.bsky.graph.follow": FollowRenderer,
    };

    const collection = $derived(getCollectionFromUri(record.uri));
    const Renderer = $derived(
        collection && RENDERERS[collection]
            ? RENDERERS[collection]
            : GenericRenderer,
    );

    // Toggle for showing raw JSON
    let showRaw = $state(false);
</script>

<div class="record-renderer">
    {#if showRawToggle}
        <div class="renderer-controls">
            <button
                class="toggle-btn"
                class:active={!showRaw}
                onclick={() => (showRaw = false)}
            >
                Formatted
            </button>
            <button
                class="toggle-btn"
                class:active={showRaw}
                onclick={() => (showRaw = true)}
            >
                Raw JSON
            </button>
        </div>
    {/if}

    {#if showRaw}
        <GenericRenderer {record} {pdsEndpoint} {did} />
    {:else}
        <Renderer {record} {pdsEndpoint} {did} />
    {/if}
</div>

<style>
    .record-renderer {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .renderer-controls {
        display: flex;
        gap: var(--space-0);
        padding-bottom: var(--space-1);
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
    }

    .toggle-btn {
        padding: var(--space-0) var(--space-1);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--color-text-3);
        background: none;
        border: var(--border-weight) solid transparent;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .toggle-btn:hover {
        color: var(--color-text);
        background: var(--color-hover-bg);
    }

    .toggle-btn.active {
        color: var(--color-accent-text);
        background: var(--color-accent-light);
        border-color: var(--color-accent);
    }
</style>
