<script lang="ts">
    import { resolveIdentity, describeRepo } from "../lib/identity";
    import {
        listRecords,
        getRecord,
        getRecordPreview,
        getRkeyFromUri,
        tidToDate,
    } from "../lib/records";
    import { addRecentSearch } from "../lib/cache";
    import type {
        ResolvedIdentity,
        DID,
        Lexicon,
        Rkey,
        RepoRecord,
    } from "../lib/types";
    import IdentityCard from "./IdentityCard.svelte";
    import RecordViewer from "./RecordViewer.svelte";
    import LoadingState from "./LoadingState.svelte";
    import ErrorDisplay from "./ErrorDisplay.svelte";

    interface Props {
        did: string;
        collection: Lexicon | null;
        rkey: Rkey | null;
    }

    let { did, collection, rkey }: Props = $props();

    // Sort options
    type SortField = "rkey" | "createdAt";
    type SortDir = "asc" | "desc";

    let sortField = $state<SortField>("createdAt");
    let sortDir = $state<SortDir>("desc");

    // State
    let identity = $state<ResolvedIdentity | null>(null);
    let collections = $state<string[]>([]);
    let records = $state<RepoRecord[]>([]);
    let record = $state<RepoRecord | null>(null);
    let cursor = $state<string | undefined>(undefined);
    let hasMore = $state(false);

    let loading = $state(true);
    let loadingMore = $state(false);
    let error = $state<string | null>(null);

    // Sorted records derived from raw records
    const sortedRecords = $derived.by(() => {
        if (records.length === 0) return [];

        return [...records].sort((a, b) => {
            let comparison = 0;

            if (sortField === "rkey") {
                const rkeyA = getRkeyFromUri(a.uri);
                const rkeyB = getRkeyFromUri(b.uri);
                comparison = rkeyA.localeCompare(rkeyB);
            } else if (sortField === "createdAt") {
                const previewA = getRecordPreview(a);
                const previewB = getRecordPreview(b);
                const timeA = previewA.timestamp?.getTime() ?? 0;
                const timeB = previewB.timestamp?.getTime() ?? 0;
                comparison = timeA - timeB;
            }

            return sortDir === "desc" ? -comparison : comparison;
        });
    });

    const view = $derived(
        rkey ? "record" : collection ? "collection" : "identity",
    );

    async function load() {
        loading = true;
        error = null;

        try {
            identity = await resolveIdentity(did);

            addRecentSearch({
                identifier: identity.did,
                handle: identity.handle,
                did: identity.did,
            });

            if (view === "identity") {
                const repoInfo = await describeRepo(
                    identity.pdsEndpoint,
                    identity.did,
                );
                collections = repoInfo.collections;
            } else if (view === "collection" && collection) {
                const result = await listRecords(
                    identity.pdsEndpoint,
                    identity.did,
                    collection,
                    {
                        limit: 50,
                        reverse: true,
                    },
                );
                records = result.records;
                cursor = result.cursor;
                hasMore = !!result.cursor;
            } else if (view === "record" && collection && rkey) {
                record = await getRecord(
                    identity.pdsEndpoint,
                    identity.did,
                    collection,
                    rkey,
                );
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load";
        } finally {
            loading = false;
        }
    }

    async function loadMoreRecords() {
        if (!identity || !collection || !cursor) return;

        loadingMore = true;
        try {
            const result = await listRecords(
                identity.pdsEndpoint,
                identity.did,
                collection,
                {
                    limit: 50,
                    cursor,
                    reverse: true,
                },
            );
            records = [...records, ...result.records];
            cursor = result.cursor;
            hasMore = !!result.cursor;
        } catch (e) {
            // Silent fail
        } finally {
            loadingMore = false;
        }
    }

    function formatTimestamp(date: Date | null): string {
        if (!date) return "—";
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function getCollectionName(coll: string): string {
        return coll.split(".").pop() || coll;
    }

    function getNamespace(coll: string): string {
        return coll.split(".").slice(0, -1).join(".");
    }

    function toggleSort(field: SortField) {
        if (sortField === field) {
            sortDir = sortDir === "desc" ? "asc" : "desc";
        } else {
            sortField = field;
            sortDir = "desc";
        }
    }

    function getSortIcon(field: SortField): string {
        if (sortField !== field) return "";
        return sortDir === "desc" ? "↓" : "↑";
    }

    function groupCollections(colls: string[]): Map<string, string[]> {
        const grouped = new Map<string, string[]>();
        for (const coll of colls) {
            const ns = getNamespace(coll);
            const existing = grouped.get(ns) || [];
            existing.push(coll);
            grouped.set(ns, existing);
        }
        return grouped;
    }

    $effect(() => {
        load();
    });
</script>

<div class="explorer">
    {#if loading}
        <LoadingState />
    {:else if error}
        <ErrorDisplay {error} onRetry={load} />
    {:else if identity}
        <!-- IDENTITY VIEW -->
        {#if view === "identity"}
            <IdentityCard {identity} showDetails={true} />

            <section class="section">
                <header class="section-header">
                    <h3 class="section-title">Collections</h3>
                    <span class="section-count">{collections.length}</span>
                </header>

                {#if collections.length === 0}
                    <p class="empty">No collections in this repository</p>
                {:else}
                    {@const grouped = groupCollections(collections)}
                    <div class="collections-grid">
                        {#each [...grouped.entries()] as [namespace, colls]}
                            <div class="namespace-group">
                                <div class="namespace-header">
                                    <span class="namespace-label"
                                        >{namespace}</span
                                    >
                                    <span class="namespace-count"
                                        >{colls.length}</span
                                    >
                                </div>
                                <div class="list">
                                    {#each colls as coll}
                                        <a
                                            href={`/at/${identity.did}/${coll}`}
                                            class="list-item"
                                        >
                                            <span class="item-name"
                                                >{getCollectionName(coll)}</span
                                            >
                                            <span class="item-arrow">→</span>
                                        </a>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </section>

            <!-- COLLECTION VIEW -->
        {:else if view === "collection" && collection}
            <header class="page-header">
                <div class="header-main">
                    <h1>{getCollectionName(collection)}</h1>
                    <span class="lexicon-badge">{getNamespace(collection)}</span
                    >
                </div>
                <p class="lexicon mono">{collection}</p>
            </header>

            {#if records.length === 0}
                <p class="empty">No records in this collection</p>
            {:else}
                <p class="record-count">
                    {records.length} records{hasMore ? "+" : ""}
                </p>

                <div class="table-wrapper">
                    <table class="data-table responsive">
                        <thead>
                            <tr>
                                <th>
                                    <button
                                        class="sort-btn"
                                        class:active={sortField === "rkey"}
                                        onclick={() => toggleSort("rkey")}
                                    >
                                        Record Key {getSortIcon("rkey")}
                                    </button>
                                </th>
                                <th>Preview</th>
                                <th>
                                    <button
                                        class="sort-btn"
                                        class:active={sortField === "createdAt"}
                                        onclick={() => toggleSort("createdAt")}
                                    >
                                        Date {getSortIcon("createdAt")}
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each sortedRecords as rec}
                                {@const preview = getRecordPreview(rec)}
                                {@const recRkey = getRkeyFromUri(rec.uri)}
                                <tr>
                                    <td data-label="Record Key">
                                        <a
                                            href={`/at/${identity.did}/${collection}/${recRkey}`}
                                            class="mono"
                                        >
                                            {recRkey}
                                        </a>
                                    </td>
                                    <td
                                        data-label="Preview"
                                        class="preview-cell">{preview.title}</td
                                    >
                                    <td data-label="Date" class="date-cell"
                                        >{formatTimestamp(
                                            preview.timestamp,
                                        )}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                {#if hasMore}
                    <div class="load-more">
                        <button
                            class="secondary"
                            onclick={loadMoreRecords}
                            disabled={loadingMore}
                        >
                            {loadingMore ? "Loading..." : "Load more records"}
                        </button>
                    </div>
                {/if}
            {/if}

            <!-- RECORD VIEW -->
        {:else if view === "record" && record}
            <header class="page-header">
                <h1 class="mono record-title">{rkey}</h1>
                <p class="lexicon mono">{collection}</p>
            </header>

            <RecordViewer
                {record}
                pdsEndpoint={identity.pdsEndpoint}
                did={identity.did}
            />
        {/if}
    {/if}
</div>

<style>
    .explorer {
        max-width: 100%;
    }

    .mono {
        font-family: var(--font-mono);
    }

    /* Page Header – compact */
    .page-header {
        margin-bottom: var(--space-2);
        padding-bottom: var(--space-1);
        border-bottom: var(--border-weight-heavy) solid var(--color-border);
    }

    .header-main {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        flex-wrap: wrap;
    }

    .page-header h1 {
        font-size: var(--text-base);
        margin-bottom: var(--space-0);
    }

    .lexicon-badge {
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        padding: var(--space-px) var(--space-0);
        background: var(--warm-grey-100);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
        color: var(--color-text-3);
    }

    .record-title {
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
        word-break: break-all;
    }

    .lexicon {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    /* Sections – tighter */
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--space-1);
        padding-bottom: var(--space-0);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .section-title {
        font-size: var(--text-sm);
        margin-bottom: 0;
    }

    .section-count {
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        color: var(--color-text-3);
        font-variant-numeric: tabular-nums;
    }

    .empty {
        color: var(--color-text-3);
        font-size: var(--text-sm);
        padding: var(--space-2) 0;
    }

    /* Collections grid – responsive */
    .collections-grid {
        display: grid;
        gap: var(--space-1);
        grid-template-columns: 1fr;
    }

    @media (min-width: 768px) {
        .collections-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (min-width: 1440px) {
        .collections-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (min-width: 1920px) {
        .collections-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }

    @media (min-width: 2560px) {
        .collections-grid {
            grid-template-columns: repeat(5, 1fr);
        }
    }

    /* Namespace groups – data panels */
    .namespace-group {
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        padding: var(--space-2);
        box-shadow: var(--shadow-md);
    }

    .namespace-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--space-0);
        padding-bottom: var(--space-0);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .namespace-label {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--color-text);
    }

    .namespace-count {
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        color: var(--color-text-3);
        font-variant-numeric: tabular-nums;
    }

    .namespace-group .list {
        background: transparent;
        border: none;
        border-radius: 0;
        overflow: visible;
    }

    .namespace-group .list-item {
        padding: var(--space-1) 0;
    }

    .namespace-group .list-item:first-child {
        padding-top: var(--space-0);
    }

    .namespace-group .list-item:last-child {
        padding-bottom: var(--space-0);
    }

    .item-name {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .item-arrow {
        color: var(--color-text-3);
        font-size: var(--text-xs);
        transition: transform 0.1s ease;
    }

    .list-item:hover .item-arrow {
        transform: translateX(3px);
    }

    .record-count {
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        color: var(--color-text-3);
        font-variant-numeric: tabular-nums;
        margin-bottom: var(--space-1);
        padding-bottom: var(--space-0);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    /* Sort buttons */
    .sort-btn {
        background: none;
        border: none;
        border-radius: var(--radius-sm);
        padding: var(--space-0) var(--space-1);
        margin: calc(-1 * var(--space-0)) calc(-1 * var(--space-1));
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-3);
        cursor: pointer;
        transition:
            color 0.15s ease,
            background 0.15s ease;
    }

    .sort-btn:hover {
        color: var(--color-text);
        background: var(--color-hover-bg);
        transform: none;
    }

    .sort-btn.active {
        color: var(--color-accent-text);
    }

    /* Records table */
    .preview-cell {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .date-cell {
        color: var(--color-text-3);
        white-space: nowrap;
    }

    .load-more {
        margin-top: var(--space-2);
        padding-top: var(--space-2);
        border-top: var(--border-weight) solid var(--color-border-light);
    }

    .load-more button {
        border-radius: var(--radius-md);
    }

    /* Table wrapper for horizontal scroll on desktop */
    .table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
</style>
