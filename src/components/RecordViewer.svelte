<script lang="ts">
    import type { RepoRecord, ViewMode, DID, AtUri } from "../lib/types";
    import { getReferences, parseAtUri } from "../lib/decode";
    import { getBlobUrl } from "../lib/records";
    import {
        getPlatformLink,
        getPlatformForCollection,
    } from "../lib/platforms";
    import {
        getAllLinkCounts,
        getBacklinkLabel,
        type LinkCountsResponse,
    } from "../lib/constellation";
    import JsonTree from "./JsonTree.svelte";
    import CollapsibleJson from "./CollapsibleJson.svelte";
    import RecordRenderer from "./records/RecordRenderer.svelte";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();

    let viewMode = $state<ViewMode>("decoded");
    let copied = $state(false);
    let linkCounts = $state<LinkCountsResponse | null>(null);
    let loadingCounts = $state(false);

    const references = $derived(getReferences(record.value));

    // Parse the record URI to get collection and rkey
    const parsed = $derived(parseAtUri(record.uri));
    const collection = $derived(parsed?.collection || "");
    const rkey = $derived(parsed?.rkey || "");

    // Get platform info
    const platformLink = $derived(
        collection ? getPlatformLink(collection, did, rkey) : null,
    );
    const platform = $derived(
        collection ? getPlatformForCollection(collection) : null,
    );

    // Fetch backlink counts when component mounts
    $effect(() => {
        if (record.uri) {
            loadingCounts = true;
            getAllLinkCounts(record.uri as AtUri).then((counts) => {
                linkCounts = counts;
                loadingCounts = false;
            });
        }
    });

    async function copyJson() {
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(record.value, null, 2),
            );
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = JSON.stringify(record.value, null, 2);
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        }
    }
</script>

<div class="viewer">
    <!-- View tabs -->
    <div class="tabs">
        <button
            class="tab"
            class:active={viewMode === "raw"}
            onclick={() => (viewMode = "raw")}
        >
            Raw
        </button>
        <button
            class="tab"
            class:active={viewMode === "decoded"}
            onclick={() => (viewMode = "decoded")}
        >
            Decoded
        </button>
        <div class="tab-actions">
            {#if platformLink && platform}
                <a
                    href={platformLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="platform-link"
                >
                    View on {platform.name} ↗
                </a>
            {/if}
            <button class="copy-btn" onclick={copyJson}>
                {copied ? "Copied" : "Copy"}
            </button>
        </div>
    </div>

    <!-- Content -->
    <div class="content">
        {#if viewMode === "raw"}
            <CollapsibleJson data={record.value} />
        {:else}
            <!-- Backlinks / Engagement -->
            {#if linkCounts && linkCounts.counts.length > 0}
                <section class="backlinks-section">
                    <h3>Backlinks · {linkCounts.total}</h3>
                    <div class="backlinks-grid">
                        {#each linkCounts.counts as { source, count }}
                            <div class="backlink-stat">
                                <span class="backlink-count">{count}</span>
                                <span class="backlink-label"
                                    >{getBacklinkLabel(source)}</span
                                >
                            </div>
                        {/each}
                    </div>
                </section>
            {:else if loadingCounts}
                <section class="backlinks-section">
                    <h3>Backlinks</h3>
                    <div class="backlinks-loading">Loading...</div>
                </section>
            {/if}

            <!-- References -->
            {#if references.length > 0}
                <section class="refs-section">
                    <h3>References · {references.length}</h3>
                    <div class="refs-list">
                        {#each references as ref}
                            <a
                                href={`/at/${ref.uri.replace("at://", "")}`}
                                class="ref-item"
                            >
                                <span class="ref-path">{ref.path}</span>
                                <span class="ref-badge">{ref.type}</span>
                                <span class="ref-uri">{ref.uri}</span>
                            </a>
                        {/each}
                    </div>
                </section>
            {/if}

            <!-- Type-aware rendered data -->
            <section class="data-section">
                <h3>Data</h3>
                <RecordRenderer
                    {record}
                    {pdsEndpoint}
                    {did}
                    showRawToggle={false}
                />
            </section>
        {/if}
    </div>

    <!-- Record metadata -->
    <footer class="meta">
        <dl class="meta-list">
            <div class="meta-row">
                <dt>URI</dt>
                <dd>{record.uri}</dd>
            </div>
            <div class="meta-row">
                <dt>CID</dt>
                <dd>{record.cid}</dd>
            </div>
        </dl>
    </footer>
</div>

<style>
    .viewer {
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        box-shadow: var(--shadow-md);
        overflow: hidden;
    }

    /* Tabs */
    .tabs {
        display: flex;
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .tab {
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        letter-spacing: 0;
        text-transform: none;
        color: var(--color-text-3);
        cursor: pointer;
        margin-bottom: -1px;
        transition:
            color 0.15s ease,
            background 0.15s ease;
    }

    .tab:hover {
        color: var(--color-text);
        background: var(--color-hover-bg);
    }

    .tab:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .tab.active {
        color: var(--color-text);
        border-bottom-color: var(--color-accent);
        background: none;
    }

    .tab.active:hover {
        background: none;
    }

    .tab-actions {
        margin-left: auto;
        display: flex;
        align-items: stretch;
        border-left: var(--border-weight) solid var(--color-border-light);
    }

    .platform-link {
        display: flex;
        align-items: center;
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--color-accent-text);
        border-bottom: none;
        border-right: var(--border-weight) solid var(--color-border-light);
        white-space: nowrap;
        transition: background 0.15s ease;
    }

    .platform-link:hover {
        background: var(--color-hover-bg);
    }

    .copy-btn {
        background: none;
        border: none;
        border-radius: 0;
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        transition:
            background 0.15s ease,
            color 0.15s ease;
    }

    .copy-btn:hover {
        color: var(--color-text);
        background: var(--color-hover-bg);
        transform: none;
    }

    .copy-btn:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 3px var(--color-accent-light);
    }

    /* Content – viewport-relative height */
    .content {
        padding: var(--space-2);
        max-height: 50vh;
        min-height: 250px;
        overflow: auto;
    }

    @media (min-width: 768px) {
        .content {
            max-height: 60vh;
            min-height: 300px;
        }
    }

    @media (min-width: 1024px) {
        .content {
            max-height: 70vh;
        }
    }

    /* Backlinks section */
    .backlinks-section {
        margin-bottom: var(--space-4);
        padding-bottom: var(--space-4);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .backlinks-section h3 {
        margin-bottom: var(--space-2);
    }

    .backlinks-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
    }

    .backlink-stat {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        min-width: 80px;
    }

    .backlink-count {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--weight-normal);
        font-variant-numeric: tabular-nums;
        line-height: var(--leading-none);
    }

    .backlink-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-3);
    }

    .backlinks-loading {
        font-size: var(--text-sm);
        color: var(--color-text-3);
    }

    /* References section */
    .refs-section {
        margin-bottom: var(--space-4);
        padding-bottom: var(--space-4);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .refs-section h3,
    .data-section h3 {
        margin-bottom: var(--space-2);
    }

    .refs-list {
        display: flex;
        flex-direction: column;
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    .ref-item {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        text-decoration: none;
        color: var(--color-text);
        border-bottom: none;
        transition: background 0.15s ease;
    }

    @media (min-width: 768px) {
        .ref-item {
            display: grid;
            grid-template-columns: 100px 80px 1fr;
            gap: var(--space-2);
            align-items: baseline;
            flex-direction: row;
        }
    }

    .ref-item + .ref-item {
        border-top: var(--border-weight) solid var(--color-border-subtle);
    }

    .ref-item:hover {
        background: var(--color-hover-bg);
    }

    .ref-item:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 3px var(--color-accent-light);
    }

    .ref-item:active {
        background: var(--warm-grey-200);
    }

    .ref-path {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .ref-badge {
        font-size: var(--text-xs);
        font-family: var(--font-mono);
        color: var(--color-text-3);
    }

    .ref-uri {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @media (max-width: 767px) {
        .ref-uri {
            white-space: normal;
            word-break: break-all;
        }
    }

    /* Footer meta */
    .meta {
        padding: var(--space-2);
        border-top: var(--border-weight) solid var(--color-border-light);
        background: var(--color-surface-raised);
    }

    .meta-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .meta-row {
        display: grid;
        grid-template-columns: 48px 1fr;
        gap: var(--space-2);
        align-items: baseline;
    }

    .meta-row dt {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-3);
    }

    .meta-row dd {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        word-break: break-all;
    }
</style>
