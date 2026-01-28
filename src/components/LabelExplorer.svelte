<script lang="ts">
    import type {
        Label,
        LabelerInfo,
        LabelValueDefinition,
    } from "../lib/types";
    import {
        KNOWN_LABELERS,
        queryLabels,
        getLabelerServices,
        formatLabelValue,
        isNegatedLabel,
        formatLabelTimestamp,
        SEVERITY_CLASSES,
        getLocalizedName,
        groupLabelsBySource,
        BLUR_DESCRIPTIONS,
    } from "../lib/labels";
    import { resolveToDidString, isDid, isHandle } from "../lib/identity";
    import Loader from "./Loader.svelte";
    import ErrorDisplay from "./ErrorDisplay.svelte";

    type Tab = "query" | "labelers";

    let activeTab = $state<Tab>("query");
    let searchInput = $state("");
    let loading = $state(false);
    let error = $state<string | null>(null);

    // Query results
    let labels = $state<Label[]>([]);
    let labelsCursor = $state<string | undefined>(undefined);

    // Labeler state
    let labelers = $state<LabelerInfo[]>([]);
    let selectedLabeler = $state<LabelerInfo | null>(null);
    let loadingLabelers = $state(false);

    async function handleSearch() {
        const input = searchInput.trim();
        if (!input) {
            error = "Please enter a handle, DID, or AT-URI";
            return;
        }

        loading = true;
        error = null;
        labels = [];
        labelsCursor = undefined;

        try {
            // Resolve to DID if it's a handle
            let subject = input;
            if (!isDid(input) && !input.startsWith("at://")) {
                subject = await resolveToDidString(input);
            }

            const result = await queryLabels([subject], {
                limit: 100,
            });
            labels = result.labels;
            labelsCursor = result.cursor;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to query labels";
        } finally {
            loading = false;
        }
    }

    async function loadMoreLabels() {
        if (!labelsCursor || loading) return;

        loading = true;
        try {
            const result = await queryLabels([searchInput.trim()], {
                limit: 100,
                cursor: labelsCursor,
            });
            labels = [...labels, ...result.labels];
            labelsCursor = result.cursor;
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to load more labels";
        } finally {
            loading = false;
        }
    }

    async function loadKnownLabelers() {
        loadingLabelers = true;
        error = null;

        try {
            const dids = KNOWN_LABELERS.map((l) => l.did);
            labelers = await getLabelerServices(dids, true);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load labelers";
        } finally {
            loadingLabelers = false;
        }
    }

    function selectLabeler(labeler: LabelerInfo) {
        selectedLabeler = selectedLabeler?.uri === labeler.uri ? null : labeler;
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            handleSearch();
        }
    }

    // Group labels by source for display
    let labelsBySource = $derived.by(() => {
        return groupLabelsBySource(labels);
    });

    // Count unique sources
    let sourceCount = $derived.by(() => {
        return labelsBySource.size;
    });

    // Load labelers when switching to that tab
    $effect(() => {
        if (activeTab === "labelers" && labelers.length === 0) {
            loadKnownLabelers();
        }
    });
</script>

<div class="label-explorer">
    <header class="page-header">
        <div class="header-main">
            <h1>Labels</h1>
            <p class="text-2">
                Query moderation labels and explore labeler services
            </p>
        </div>
        <div class="status-indicator">
            {#if loading || loadingLabelers}
                <span class="status-dot loading"></span>
                <span>Loading...</span>
            {:else if labels.length > 0}
                <span class="status-dot ready"></span>
                <span>{labels.length} labels</span>
            {:else if labelers.length > 0 && activeTab === "labelers"}
                <span class="status-dot ready"></span>
                <span>{labelers.length} labelers</span>
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
                    class:active={activeTab === "query"}
                    onclick={() => (activeTab = "query")}
                >
                    Query Labels
                </button>
                <button
                    class="tab"
                    class:active={activeTab === "labelers"}
                    onclick={() => (activeTab = "labelers")}
                >
                    Labelers
                </button>
            </div>

            {#if activeTab === "query"}
                <div class="search-group">
                    <label for="label-search" class="visually-hidden"
                        >Search by handle, DID, or AT-URI</label
                    >
                    <input
                        id="label-search"
                        type="text"
                        bind:value={searchInput}
                        onkeydown={handleKeyDown}
                        placeholder="handle, DID, or AT-URI"
                        class="mono"
                    />
                    <button
                        onclick={handleSearch}
                        disabled={loading || !searchInput.trim()}
                    >
                        {loading ? "Loading..." : "Query"}
                    </button>
                </div>
            {/if}
        </div>
        {#if activeTab === "query"}
            <p class="hint text-3">
                Enter a DID to see all labels on that account, or an AT-URI to
                see labels on a specific record.
            </p>
        {/if}
    </div>

    {#if error}
        <ErrorDisplay message={error} />
    {/if}

    <div class="stream-container">
        {#if activeTab === "query"}
            <div class="stream-header">
                <div class="stat">
                    <span class="stat-value">{labels.length}</span>
                    <span class="stat-label">Labels</span>
                </div>
                <div class="stat">
                    <span class="stat-value">{sourceCount}</span>
                    <span class="stat-label">Sources</span>
                </div>
                {#if labelsCursor}
                    <button
                        class="btn-ghost"
                        onclick={loadMoreLabels}
                        disabled={loading}
                    >
                        {loading ? "Loading..." : "Load More"}
                    </button>
                {/if}
            </div>

            <div class="content-list">
                {#if loading && labels.length === 0}
                    <div class="loading-state">
                        <Loader />
                    </div>
                {:else if labels.length > 0}
                    {#each [...labelsBySource.entries()] as [source, sourceLabels]}
                        <div class="source-section">
                            <div class="source-header">
                                <span class="source-label">From</span>
                                <a href="/at/{source}" class="mono">{source}</a>
                            </div>
                            {#each sourceLabels as label}
                                <div class="label-item">
                                    <div class="label-value">
                                        <span
                                            class="label-badge"
                                            class:negated={isNegatedLabel(
                                                label,
                                            )}
                                        >
                                            {#if isNegatedLabel(label)}
                                                <span class="strike">⊘</span>
                                            {/if}
                                            {formatLabelValue(label.val)}
                                        </span>
                                    </div>
                                    <div class="label-subject">
                                        <a
                                            href="/at/{label.uri.replace(
                                                'at://',
                                                '',
                                            )}"
                                            class="mono truncate"
                                        >
                                            {label.uri}
                                        </a>
                                    </div>
                                    <div class="label-time text-3">
                                        {formatLabelTimestamp(label.cts)}
                                    </div>
                                    <div class="label-status">
                                        {#if isNegatedLabel(label)}
                                            <span class="badge">Removed</span>
                                        {:else if label.exp}
                                            <span class="badge"
                                                >Expires {formatLabelTimestamp(
                                                    label.exp,
                                                )}</span
                                            >
                                        {:else}
                                            <span class="badge badge-accent"
                                                >Active</span
                                            >
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/each}
                {:else if searchInput.trim() && !loading}
                    <div class="empty-state">
                        <p class="text-3">No labels found for this subject</p>
                    </div>
                {:else}
                    <div class="empty-state">
                        <p class="text-3">
                            Enter a DID or AT-URI to query labels
                        </p>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="stream-header">
                <div class="stat">
                    <span class="stat-value">{labelers.length}</span>
                    <span class="stat-label">Labelers</span>
                </div>
                {#if selectedLabeler}
                    <div class="stat">
                        <span class="stat-value"
                            >{selectedLabeler.policies.labelValues.length}</span
                        >
                        <span class="stat-label">Label Types</span>
                    </div>
                {/if}
                {#if !labelers.length && !loadingLabelers}
                    <button onclick={loadKnownLabelers}>Load Labelers</button>
                {/if}
            </div>

            <div class="content-list">
                {#if loadingLabelers}
                    <div class="loading-state">
                        <Loader />
                    </div>
                {:else if labelers.length > 0}
                    {#each labelers as labeler}
                        <button
                            class="labeler-row"
                            class:selected={selectedLabeler?.uri ===
                                labeler.uri}
                            onclick={() => selectLabeler(labeler)}
                        >
                            <div class="labeler-name">
                                <a
                                    href="/at/{labeler.creator.did}"
                                    onclick={(e) => e.stopPropagation()}
                                >
                                    {labeler.creator.displayName ||
                                        labeler.creator.handle}
                                </a>
                            </div>
                            <div class="labeler-labels">
                                {labeler.policies.labelValues.length}
                            </div>
                            <div class="labeler-subs">
                                {labeler.likeCount?.toLocaleString() ?? "—"}
                            </div>
                        </button>
                    {/each}

                    {#if selectedLabeler}
                        <div class="labeler-detail">
                            <div class="detail-header">
                                <h3>Label Definitions</h3>
                                <a
                                    href="/at/{selectedLabeler.creator.did}"
                                    class="text-3"
                                >
                                    View Profile →
                                </a>
                            </div>

                            {#if selectedLabeler.policies.labelValueDefinitions && selectedLabeler.policies.labelValueDefinitions.length > 0}
                                <div class="definitions-list">
                                    {#each selectedLabeler.policies.labelValueDefinitions as def}
                                        {@const localized =
                                            getLocalizedName(def)}
                                        {@const severityClass =
                                            SEVERITY_CLASSES[def.severity] ||
                                            SEVERITY_CLASSES.none}

                                        <div class="definition-item">
                                            <div class="def-header">
                                                <span
                                                    class="def-badge {severityClass}"
                                                >
                                                    {localized.name}
                                                </span>
                                                <code class="def-id"
                                                    >{def.identifier}</code
                                                >
                                            </div>

                                            <p class="def-description text-2">
                                                {localized.description}
                                            </p>

                                            <div class="def-meta">
                                                <span class="meta-item">
                                                    <span class="meta-label"
                                                        >Severity:</span
                                                    >
                                                    {def.severity}
                                                </span>
                                                <span class="meta-item">
                                                    <span class="meta-label"
                                                        >Blurs:</span
                                                    >
                                                    {BLUR_DESCRIPTIONS[
                                                        def.blurs
                                                    ]}
                                                </span>
                                                {#if def.defaultSetting}
                                                    <span class="meta-item">
                                                        <span class="meta-label"
                                                            >Default:</span
                                                        >
                                                        {def.defaultSetting}
                                                    </span>
                                                {/if}
                                                {#if def.adultOnly}
                                                    <span
                                                        class="meta-item badge"
                                                        >Adult Only</span
                                                    >
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div class="simple-labels">
                                    <p class="text-3 mb-2">
                                        This labeler uses simple label values
                                        without detailed definitions:
                                    </p>
                                    <div class="label-chips">
                                        {#each selectedLabeler.policies.labelValues as val}
                                            <span class="label-chip"
                                                >{formatLabelValue(val)}</span
                                            >
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}
                {:else}
                    <div class="empty-state">
                        <p class="text-3">No labelers loaded</p>
                        <button onclick={loadKnownLabelers} class="mt-2"
                            >Load Known Labelers</button
                        >
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .label-explorer {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    @media (min-width: 768px) {
        .label-explorer {
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
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .status-dot.ready {
        background: var(--color-success);
        box-shadow: 0 0 8px var(--color-success);
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

    .hint {
        font-size: var(--text-xs);
        margin-top: var(--space-2);
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
        padding: var(--space-4);
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        height: 100%;
    }

    /* Label items - grid layout like event-item */
    .source-section {
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .source-header {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface-raised);
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
    }

    .source-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .source-header a {
        font-size: var(--text-xs);
    }

    .label-item {
        display: grid;
        grid-template-columns: 100px 1fr 80px 80px;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        font-size: var(--text-sm);
        align-items: center;
    }

    .label-item:hover {
        background: var(--color-hover-bg);
    }

    .label-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-0);
        padding: var(--space-0) var(--space-1);
        background: var(--color-accent-light);
        color: var(--color-accent-text);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
    }

    .label-badge.negated {
        background: var(--warm-grey-100);
        color: var(--color-text-3);
        text-decoration: line-through;
    }

    .label-subject {
        min-width: 0;
    }

    .label-subject a {
        display: block;
        font-size: var(--text-xs);
    }

    .label-time {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
    }

    /* Labelers section */
    .labeler-row {
        display: grid;
        grid-template-columns: 1fr 50px 70px;
        gap: var(--space-1);
        width: 100%;
        padding: var(--space-1) var(--space-2);
        border: none;
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        background: transparent;
        text-align: left;
        font-size: var(--text-sm);
        align-items: center;
        cursor: pointer;
        transition: background 0.15s ease;
        color: var(--color-text);
    }

    .labeler-row:hover {
        background: var(--color-hover-bg);
    }

    .labeler-row.selected {
        background: var(--color-accent-light);
    }

    .labeler-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .labeler-name a {
        color: var(--color-text);
        border-bottom: none;
    }

    .labeler-name a:hover {
        color: var(--color-accent-text);
    }

    .labeler-labels,
    .labeler-subs {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-2);
        text-align: right;
    }

    .labeler-detail {
        flex: 1;
        padding: var(--space-2);
        overflow-y: auto;
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-2);
        padding-bottom: var(--space-1);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .detail-header h3 {
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .definitions-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .definition-item {
        padding: var(--space-1);
        background: var(--color-surface-raised);
        border-radius: var(--radius-md);
    }

    .def-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-1);
    }

    .def-badge {
        padding: var(--space-0) var(--space-1);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        border: var(--border-weight) solid;
    }

    .def-badge.severity-inform {
        background: var(--color-accent-light);
        color: var(--blue-600);
        border-color: var(--blue-300);
    }

    .def-badge.severity-alert {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
        border-color: var(--color-warning);
    }

    .def-badge.severity-none {
        background: var(--warm-grey-100);
        color: var(--warm-grey-600);
        border-color: var(--warm-grey-300);
    }

    .def-id {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .def-description {
        font-size: var(--text-sm);
        margin-bottom: var(--space-2);
    }

    .def-meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        font-size: var(--text-xs);
    }

    .meta-item {
        display: flex;
        gap: var(--space-0);
    }

    .meta-label {
        color: var(--color-text-3);
    }

    .simple-labels {
        padding: var(--space-2);
    }

    .label-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
    }

    .label-chip {
        padding: var(--space-0) var(--space-1);
        background: var(--warm-grey-100);
        border-radius: var(--radius-sm);
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

        .label-item {
            grid-template-columns: 1fr;
            gap: var(--space-1);
        }

        .def-meta {
            flex-direction: column;
            gap: var(--space-1);
        }
    }
</style>
