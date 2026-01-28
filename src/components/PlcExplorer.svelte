<script lang="ts">
    import type {
        DidDocument,
        PlcOperation,
        PlcExportEntry,
    } from "../lib/types";
    import {
        getDidDocument,
        getOperationLog,
        exportDirectory,
        formatOperationType,
        extractHandle,
        extractPdsEndpoint,
        diffOperations,
        formatTimestamp,
        isValidPlcDid,
    } from "../lib/plc";
    import { resolveToDidString, isDid, isHandle } from "../lib/identity";
    import Loader from "./Loader.svelte";
    import ErrorDisplay from "./ErrorDisplay.svelte";

    type Tab = "lookup" | "recent";

    let activeTab = $state<Tab>("lookup");
    let searchInput = $state("");
    let loading = $state(false);
    let error = $state<string | null>(null);

    // Lookup state
    let didDocument = $state<DidDocument | null>(null);
    let operations = $state<PlcOperation[]>([]);
    let selectedOperationIndex = $state<number | null>(null);

    // Recent registrations state
    let recentEntries = $state<PlcExportEntry[]>([]);
    let loadingRecent = $state(false);
    let recentCursor = $state<string | undefined>(undefined);

    async function handleSearch() {
        const input = searchInput.trim();
        if (!input) return;

        loading = true;
        error = null;
        didDocument = null;
        operations = [];
        selectedOperationIndex = null;

        try {
            // Resolve handle or DID to a DID string
            let did = input;

            if (input.startsWith("at://")) {
                did = input.replace("at://", "").split("/")[0];
            }

            // If it's a handle, resolve it first
            if (!isDid(did)) {
                did = await resolveToDidString(did);
            }

            if (!isValidPlcDid(did)) {
                error =
                    "This DID is not a did:plc: - PLC Directory only tracks did:plc identifiers.";
                loading = false;
                return;
            }

            const [doc, ops] = await Promise.all([
                getDidDocument(did),
                getOperationLog(did),
            ]);

            didDocument = doc;
            operations = ops;
        } catch (e) {
            error =
                e instanceof Error
                    ? e.message
                    : "Failed to fetch DID information";
        } finally {
            loading = false;
        }
    }

    async function loadRecentRegistrations() {
        loadingRecent = true;
        try {
            // Fetch recent entries by starting from 5 minutes ago and paginating forward to now
            const startTime = new Date(
                Date.now() - 5 * 60 * 1000,
            ).toISOString();
            let allEntries: PlcExportEntry[] = [];
            let cursor: string | undefined = startTime;

            // Fetch up to 1000 entries (10 pages) to get recent activity
            for (let i = 0; i < 10 && cursor; i++) {
                const entries = await exportDirectory({
                    after: cursor,
                    count: 100,
                });
                if (entries.length === 0) break;
                allEntries = [...allEntries, ...entries];
                cursor = entries[entries.length - 1].createdAt;
            }

            // Reverse to show most recent first
            recentEntries = allEntries.reverse();
            // Store the start time for "load more" (to fetch entries before this time)
            if (allEntries.length > 0) {
                recentCursor = startTime;
            }
        } catch (e) {
            error =
                e instanceof Error
                    ? e.message
                    : "Failed to load recent registrations";
        } finally {
            loadingRecent = false;
        }
    }

    async function loadMoreRecent() {
        if (!recentCursor || loadingRecent) return;

        loadingRecent = true;
        try {
            // Load older entries by going back another 5 minutes from current cursor
            const olderTime = new Date(
                new Date(recentCursor).getTime() - 5 * 60 * 1000,
            ).toISOString();
            let newEntries: PlcExportEntry[] = [];
            let cursor: string | undefined = olderTime;

            // Fetch entries between olderTime and recentCursor
            while (cursor && cursor < recentCursor) {
                const entries = await exportDirectory({
                    after: cursor,
                    count: 100,
                });
                if (entries.length === 0) break;

                // Only include entries before recentCursor
                const filtered = entries.filter(
                    (e) => e.createdAt < recentCursor!,
                );
                newEntries = [...newEntries, ...filtered];

                if (
                    filtered.length < entries.length ||
                    newEntries.length >= 100
                )
                    break;
                cursor = entries[entries.length - 1].createdAt;
            }

            // Append older entries at the end (reversed so newest of the old batch first)
            recentEntries = [...recentEntries, ...newEntries.reverse()];
            recentCursor = olderTime;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load more";
        } finally {
            loadingRecent = false;
        }
    }

    function selectDid(did: string) {
        searchInput = did;
        activeTab = "lookup";
        handleSearch();
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            handleSearch();
        }
    }

    // Load recent when switching to that tab
    $effect(() => {
        if (activeTab === "recent" && recentEntries.length === 0) {
            loadRecentRegistrations();
        }
    });

    // Get differences between selected operation and previous
    let operationDiffs = $derived.by(() => {
        if (selectedOperationIndex === null || selectedOperationIndex === 0) {
            return [];
        }
        const older = operations[selectedOperationIndex - 1];
        const newer = operations[selectedOperationIndex];
        return diffOperations(older, newer);
    });
</script>

<div class="plc-explorer">
    <header class="page-header">
        <div class="header-main">
            <h1>PLC Directory</h1>
            <p class="text-2">
                Explore DID operation history and browse recent registrations
            </p>
        </div>
        <div class="status-indicator">
            {#if loading || loadingRecent}
                <span class="status-dot loading"></span>
                <span>Loading...</span>
            {:else if didDocument}
                <span class="status-dot ready"></span>
                <span>DID Loaded</span>
            {:else if recentEntries.length > 0 && activeTab === "recent"}
                <span class="status-dot ready"></span>
                <span>{recentEntries.length} entries</span>
            {:else}
                <span class="status-dot idle"></span>
                <span>Ready</span>
            {/if}
        </div>
    </header>

    <div class="controls card">
        <div class="control-row">
            <div class="tabs-inline">
                <button
                    class="tab"
                    class:active={activeTab === "lookup"}
                    onclick={() => (activeTab = "lookup")}
                >
                    DID Lookup
                </button>
                <button
                    class="tab"
                    class:active={activeTab === "recent"}
                    onclick={() => (activeTab = "recent")}
                >
                    Recent Registrations
                </button>
            </div>

            {#if activeTab === "lookup"}
                <div class="search-group">
                    <label for="plc-search" class="visually-hidden"
                        >Search by handle or DID</label
                    >
                    <input
                        id="plc-search"
                        type="text"
                        bind:value={searchInput}
                        onkeydown={handleKeyDown}
                        placeholder="handle or DID"
                        class="mono"
                    />
                    <button
                        onclick={handleSearch}
                        disabled={loading || !searchInput.trim()}
                    >
                        {loading ? "Loading..." : "Lookup"}
                    </button>
                </div>
            {/if}
        </div>
    </div>

    {#if error}
        <ErrorDisplay message={error} />
    {/if}

    <div class="stream-container">
        {#if activeTab === "lookup"}
            <div class="stream-header">
                {#if didDocument}
                    <div class="stat">
                        <span class="stat-value">{operations.length}</span>
                        <span class="stat-label">Operations</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value"
                            >{didDocument.service?.length ?? 0}</span
                        >
                        <span class="stat-label">Services</span>
                    </div>
                {:else}
                    <div class="stat">
                        <span class="stat-value">—</span>
                        <span class="stat-label">Operations</span>
                    </div>
                {/if}
            </div>

            <div class="content-list">
                {#if loading}
                    <div class="loading-state">
                        <Loader />
                    </div>
                {:else if didDocument}
                    <div class="lookup-content">
                        <div class="did-panel">
                            <div class="panel-header">
                                <span class="panel-label"
                                    >Current DID Document</span
                                >
                            </div>

                            <dl class="data-list">
                                <dt>DID</dt>
                                <dd>
                                    <a href="/at/{didDocument.id}" class="mono"
                                        >{didDocument.id}</a
                                    >
                                </dd>

                                {#if didDocument.alsoKnownAs && didDocument.alsoKnownAs.length > 0}
                                    <dt>Handles</dt>
                                    <dd>
                                        {#each didDocument.alsoKnownAs as aka}
                                            <div>
                                                {aka.replace("at://", "@")}
                                            </div>
                                        {/each}
                                    </dd>
                                {/if}

                                {#if didDocument.service && didDocument.service.length > 0}
                                    <dt>Services</dt>
                                    <dd>
                                        {#each didDocument.service as service}
                                            <div class="service-item">
                                                <span class="badge"
                                                    >{service.type}</span
                                                >
                                                <a
                                                    href={service.serviceEndpoint}
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    {new URL(
                                                        service.serviceEndpoint,
                                                    ).host}
                                                </a>
                                            </div>
                                        {/each}
                                    </dd>
                                {/if}

                                {#if didDocument.verificationMethod && didDocument.verificationMethod.length > 0}
                                    <dt>Verification</dt>
                                    <dd>
                                        {#each didDocument.verificationMethod as method}
                                            <div class="verification-item">
                                                <span class="badge badge-sm"
                                                    >{method.type}</span
                                                >
                                                <code class="key-preview">
                                                    {method.publicKeyMultibase?.slice(
                                                        0,
                                                        16,
                                                    )}...
                                                </code>
                                            </div>
                                        {/each}
                                    </dd>
                                {/if}
                            </dl>
                        </div>

                        {#if operations.length > 0}
                            <div class="operations-panel">
                                <div class="panel-header">
                                    <span class="panel-label"
                                        >Operation History</span
                                    >
                                    <span class="badge"
                                        >{operations.length}</span
                                    >
                                </div>

                                <div class="operations-grid">
                                    <div class="timeline-list">
                                        {#each operations as op, index}
                                            <button
                                                class="timeline-item"
                                                class:selected={selectedOperationIndex ===
                                                    index}
                                                onclick={() =>
                                                    (selectedOperationIndex =
                                                        selectedOperationIndex ===
                                                        index
                                                            ? null
                                                            : index)}
                                            >
                                                <div class="timeline-content">
                                                    <div
                                                        class="timeline-header"
                                                    >
                                                        <span
                                                            class="badge"
                                                            class:badge-accent={op
                                                                .operation
                                                                .type ===
                                                                "create"}
                                                        >
                                                            {formatOperationType(
                                                                op.operation
                                                                    .type,
                                                            )}
                                                        </span>
                                                        <span class="timestamp"
                                                            >{formatTimestamp(
                                                                op.createdAt,
                                                            )}</span
                                                        >
                                                    </div>
                                                    {#if op.nullified}
                                                        <span
                                                            class="badge badge-dark"
                                                            >Nullified</span
                                                        >
                                                    {/if}
                                                </div>
                                            </button>
                                        {/each}
                                    </div>

                                    {#if selectedOperationIndex !== null}
                                        <div class="operation-detail">
                                            <div class="detail-header">
                                                <h3>Operation Details</h3>
                                                <span class="mono text-3"
                                                    >{operations[
                                                        selectedOperationIndex
                                                    ].cid}</span
                                                >
                                            </div>

                                            {#if operationDiffs.length > 0}
                                                <div class="diffs">
                                                    <h4>
                                                        Changes from Previous
                                                    </h4>
                                                    {#each operationDiffs as diff}
                                                        <div class="diff-item">
                                                            <dt>
                                                                {diff.field}
                                                            </dt>
                                                            <dd>
                                                                <div
                                                                    class="diff-old"
                                                                >
                                                                    <span
                                                                        class="diff-label"
                                                                        >Before:</span
                                                                    >
                                                                    <code
                                                                        >{JSON.stringify(
                                                                            diff.oldValue,
                                                                        )}</code
                                                                    >
                                                                </div>
                                                                <div
                                                                    class="diff-new"
                                                                >
                                                                    <span
                                                                        class="diff-label"
                                                                        >After:</span
                                                                    >
                                                                    <code
                                                                        >{JSON.stringify(
                                                                            diff.newValue,
                                                                        )}</code
                                                                    >
                                                                </div>
                                                            </dd>
                                                        </div>
                                                    {/each}
                                                </div>
                                            {/if}

                                            <details class="raw-operation">
                                                <summary>Raw Operation</summary>
                                                <pre>{JSON.stringify(
                                                        operations[
                                                            selectedOperationIndex
                                                        ],
                                                        null,
                                                        2,
                                                    )}</pre>
                                            </details>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="empty-state">
                        <p class="text-3">
                            Enter a DID to view its document and operation
                            history
                        </p>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="stream-header">
                <div class="stat">
                    <span class="stat-value">{recentEntries.length}</span>
                    <span class="stat-label">Entries</span>
                </div>
                {#if recentCursor}
                    <button
                        class="btn-ghost"
                        onclick={loadMoreRecent}
                        disabled={loadingRecent}
                    >
                        {loadingRecent ? "Loading..." : "Load More"}
                    </button>
                {/if}
            </div>

            <div class="content-list">
                {#if loadingRecent && recentEntries.length === 0}
                    <div class="loading-state">
                        <Loader />
                    </div>
                {:else if recentEntries.length > 0}
                    {#each recentEntries as entry}
                        <button
                            class="entry-item"
                            onclick={() => selectDid(entry.did)}
                        >
                            <div class="entry-did mono">
                                {entry.did}
                            </div>
                            <div class="entry-handle">
                                {extractHandle(entry.operation.alsoKnownAs) ||
                                    "—"}
                            </div>
                            <div class="entry-pds">
                                {#if extractPdsEndpoint(entry.operation.services)}
                                    <code
                                        >{new URL(
                                            extractPdsEndpoint(
                                                entry.operation.services,
                                            )!,
                                        ).host}</code
                                    >
                                {:else}
                                    —
                                {/if}
                            </div>
                            <div class="entry-type">
                                <span
                                    class="badge"
                                    class:badge-accent={entry.operation.type ===
                                        "create"}
                                >
                                    {formatOperationType(entry.operation.type)}
                                </span>
                            </div>
                            <div class="entry-time text-3">
                                {formatTimestamp(entry.createdAt)}
                            </div>
                        </button>
                    {/each}
                {:else}
                    <div class="empty-state">
                        <p class="text-3">No recent registrations found</p>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .plc-explorer {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    @media (min-width: 768px) {
        .plc-explorer {
            height: calc(100vh - 180px);
            min-height: 500px;
        }
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-shrink: 0;
    }

    .header-main h1 {
        margin-bottom: var(--space-0);
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-sm);
        color: var(--color-text-2);
    }

    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .status-dot.ready {
        background: var(--color-success);
        box-shadow: 0 0 10px var(--color-success);
    }

    .status-dot.loading {
        background: var(--color-warning);
        animation: pulse 1s infinite;
    }

    .status-dot.idle {
        background: var(--color-text-3);
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    .controls {
        flex-shrink: 0;
        padding: var(--space-2);
    }

    .control-row {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
        align-items: center;
    }

    .tabs-inline {
        display: flex;
        gap: var(--space-0);
    }

    .tab {
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--color-text-3);
        background: none;
        border: var(--border-weight) solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .tab:hover {
        color: var(--color-text);
        background: var(--color-hover-bg);
    }

    .tab.active {
        color: var(--color-accent-text);
        background: var(--color-accent-light);
        border-color: var(--color-accent);
    }

    .search-group {
        flex: 1;
        display: flex;
        gap: var(--space-2);
        min-width: 250px;
    }

    .search-group input {
        flex: 1;
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
    }

    .stream-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    @media (min-width: 768px) {
        .stream-container {
            min-height: 0;
        }
    }

    .stream-header {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        padding: var(--space-1) var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-light);
        background: var(--color-surface-raised);
        flex-shrink: 0;
    }

    .stat {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
    }

    .stat .stat-value {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .stat .stat-label {
        font-size: var(--text-2xs);
        color: var(--color-text-3);
        text-transform: uppercase;
    }

    .btn-ghost {
        background: transparent;
        border: var(--border-weight) solid var(--color-border-light);
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-ghost:hover:not(:disabled) {
        background: var(--color-hover-bg);
        border-color: var(--color-accent);
    }

    .btn-ghost:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .content-list {
        flex: 1;
        overflow-y: auto;
    }

    @media (min-width: 768px) {
        .content-list {
            min-height: 0;
        }
    }

    @media (max-width: 767px) {
        .content-list {
            max-height: 60vh;
        }
    }

    .loading-state {
        display: flex;
        justify-content: center;
        padding: var(--space-6);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        height: 100%;
    }

    /* Lookup content - split panel layout */
    .lookup-content {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .did-panel {
        padding: var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .panel-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
    }

    .panel-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .data-list {
        font-size: var(--text-sm);
    }

    .service-item,
    .verification-item {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        margin-bottom: var(--space-0);
    }

    .key-preview {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .operations-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .operations-panel .panel-header {
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-raised);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .operations-grid {
        display: flex;
        flex: 1;
        min-height: 0;
    }

    @media (max-width: 1023px) {
        .operations-grid {
            flex-direction: column;
        }
    }

    .timeline-list {
        flex-shrink: 0;
        overflow-y: auto;
        border-right: var(--border-weight) solid var(--color-border-light);
    }

    @media (min-width: 1024px) {
        .timeline-list {
            width: clamp(250px, 20vw, 400px);
        }
    }

    @media (max-width: 1023px) {
        .timeline-list {
            max-height: min(300px, 40vh);
            border-right: none;
            border-bottom: var(--border-weight) solid var(--color-border-light);
        }
    }

    .timeline-item {
        display: flex;
        width: 100%;
        padding: var(--space-1) var(--space-2);
        background: none;
        border: none;
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease;
        color: var(--color-text);
    }

    .timeline-item:hover {
        background: var(--color-hover-bg);
    }

    .timeline-item.selected {
        background: var(--color-accent-light);
    }

    .timeline-content {
        flex: 1;
        min-width: 0;
    }

    .timeline-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .timestamp {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .operation-detail {
        flex: 1;
        padding: var(--space-3);
        overflow-y: auto;
    }

    .detail-header {
        margin-bottom: var(--space-2);
    }

    .detail-header h3 {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        margin-bottom: var(--space-0);
    }

    .diffs {
        margin-bottom: var(--space-3);
    }

    .diffs h4 {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
        margin-bottom: var(--space-2);
    }

    .diff-item {
        margin-bottom: var(--space-2);
    }

    .diff-item dt {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        color: var(--color-text-2);
        margin-bottom: var(--space-0);
    }

    .diff-item dd {
        font-size: var(--text-xs);
    }

    .diff-old,
    .diff-new {
        display: flex;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-1);
        border-radius: var(--radius-sm);
    }

    .diff-old {
        background: var(--color-error-light);
    }

    .diff-new {
        background: var(--color-success-light);
    }

    .diff-label {
        font-weight: var(--weight-semibold);
        color: var(--color-text-3);
        flex-shrink: 0;
    }

    .diff-item code {
        font-size: var(--text-xs);
        word-break: break-all;
    }

    .raw-operation {
        margin-top: var(--space-2);
    }

    .raw-operation summary {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
        cursor: pointer;
        padding: var(--space-1) 0;
    }

    .raw-operation pre {
        font-size: var(--text-xs);
        max-height: 300px;
        overflow: auto;
        margin-top: var(--space-1);
    }

    /* Recent entries - grid layout like event-item */
    .entry-item {
        display: grid;
        grid-template-columns:
            minmax(180px, 1fr) minmax(100px, 1fr) minmax(120px, 1fr)
            60px 120px;
        gap: var(--space-1);
        width: 100%;
        padding: var(--space-0) var(--space-2);
        background: none;
        border: none;
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        font-size: var(--text-sm);
        text-align: left;
        cursor: pointer;
        align-items: center;
        transition: background 0.15s ease;
        color: var(--color-text);
    }

    .entry-item:hover {
        background: var(--color-hover-bg);
    }

    .entry-did {
        font-size: var(--text-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .entry-handle {
        font-size: var(--text-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .entry-pds {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .entry-pds code {
        font-size: var(--text-xs);
    }

    .entry-time {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
    }

    /* Responsive */
    @media (max-width: 767px) {
        .control-row {
            flex-direction: column;
            align-items: stretch;
        }

        .tabs-inline {
            width: 100%;
        }

        .tab {
            flex: 1;
            text-align: center;
        }

        .search-group {
            min-width: 0;
        }

        .entry-item {
            grid-template-columns: 1fr;
            gap: var(--space-1);
        }

        .timeline-header {
            flex-wrap: wrap;
        }

        .timestamp {
            width: 100%;
        }
    }
</style>
