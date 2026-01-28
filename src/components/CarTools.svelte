<script lang="ts">
    import type { ParsedCar, ParsedBlock } from "../lib/types";
    import {
        parseCar,
        fetchAndParseCar,
        downloadRepoCar,
        formatBytes,
        getBlockType,
        truncateCid,
        isCarFile,
        readFileAsArrayBuffer,
        MAX_CAR_SIZE,
        CAR_SIZE_WARNING,
    } from "../lib/car";
    import { resolveIdentity } from "../lib/identity";
    import Loader from "./Loader.svelte";
    import ErrorDisplay from "./ErrorDisplay.svelte";

    type Tab = "import" | "export";

    let activeTab = $state<Tab>("import");

    // Import state
    let carUrl = $state("");
    let parsedCar = $state<ParsedCar | null>(null);
    let selectedBlock = $state<ParsedBlock | null>(null);
    let loadingImport = $state(false);
    let importError = $state<string | null>(null);
    let dragOver = $state(false);

    // Export state
    let exportIdentifier = $state("");
    let loadingExport = $state(false);
    let exportError = $state<string | null>(null);
    let exportProgress = $state<{
        loaded: number;
        total: number | null;
    } | null>(null);

    // File input ref
    let fileInput = $state<HTMLInputElement | null>(null);

    async function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        await parseFile(file);
    }

    async function parseFile(file: File) {
        if (!isCarFile(file.name)) {
            importError = "Please select a .car file";
            return;
        }

        if (file.size > MAX_CAR_SIZE) {
            importError = `File too large (${formatBytes(file.size)}). Maximum size is ${formatBytes(MAX_CAR_SIZE)}.`;
            return;
        }

        loadingImport = true;
        importError = null;
        parsedCar = null;
        selectedBlock = null;

        try {
            const buffer = await readFileAsArrayBuffer(file);
            parsedCar = await parseCar(buffer);
        } catch (e) {
            importError =
                e instanceof Error ? e.message : "Failed to parse CAR file";
        } finally {
            loadingImport = false;
        }
    }

    async function handleUrlFetch() {
        if (!carUrl.trim()) return;

        loadingImport = true;
        importError = null;
        parsedCar = null;
        selectedBlock = null;

        try {
            parsedCar = await fetchAndParseCar(carUrl.trim());
        } catch (e) {
            importError =
                e instanceof Error ? e.message : "Failed to fetch CAR file";
        } finally {
            loadingImport = false;
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        dragOver = false;

        const file = event.dataTransfer?.files[0];
        if (file) {
            parseFile(file);
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    function handleDropZoneKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput?.click();
        }
    }

    function selectBlock(block: ParsedBlock) {
        selectedBlock = selectedBlock?.cid === block.cid ? null : block;
    }

    function clearCar() {
        parsedCar = null;
        selectedBlock = null;
        carUrl = "";
    }

    async function handleExport() {
        if (!exportIdentifier.trim()) return;

        loadingExport = true;
        exportError = null;
        exportProgress = null;

        try {
            const identity = await resolveIdentity(exportIdentifier.trim());

            await downloadRepoCar(
                identity.pdsEndpoint,
                identity.did,
                (loaded, total) => {
                    exportProgress = { loaded, total };
                },
            );
        } catch (e) {
            exportError =
                e instanceof Error ? e.message : "Failed to export repo";
        } finally {
            loadingExport = false;
            exportProgress = null;
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            if (activeTab === "import") {
                handleUrlFetch();
            } else {
                handleExport();
            }
        }
    }

    // Group blocks by type
    let blocksByType = $derived.by(() => {
        if (!parsedCar) return new Map<string, ParsedBlock[]>();

        const groups = new Map<string, ParsedBlock[]>();
        for (const block of parsedCar.blocks) {
            const type = getBlockType(block.decoded);
            const existing = groups.get(type) || [];
            existing.push(block);
            groups.set(type, existing);
        }
        return groups;
    });

    // Total size
    let totalSize = $derived.by(() => {
        if (!parsedCar) return 0;
        return parsedCar.blocks.reduce((sum, b) => sum + b.bytes.length, 0);
    });
</script>

<div class="car-tools">
    <header class="page-header">
        <div class="header-main">
            <h1>CAR Tools</h1>
            <p class="text-2">
                Import, inspect, and export ATProto repository archives
            </p>
        </div>
        <div class="status-indicator">
            {#if loadingImport || loadingExport}
                <span class="status-dot loading"></span>
                <span>{loadingImport ? "Parsing..." : "Downloading..."}</span>
            {:else if parsedCar}
                <span class="status-dot ready"></span>
                <span>CAR Loaded</span>
            {:else if exportProgress}
                <span class="status-dot loading"></span>
                <span>{formatBytes(exportProgress.loaded)}</span>
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
                    class:active={activeTab === "import"}
                    onclick={() => (activeTab = "import")}
                >
                    Import & Inspect
                </button>
                <button
                    class="tab"
                    class:active={activeTab === "export"}
                    onclick={() => (activeTab = "export")}
                >
                    Export Repo
                </button>
            </div>

            {#if activeTab === "import"}
                <div class="import-controls">
                    <div
                        class="drop-zone-inline"
                        class:drag-over={dragOver}
                        ondrop={handleDrop}
                        ondragover={handleDragOver}
                        ondragleave={handleDragLeave}
                        onclick={() => fileInput?.click()}
                        onkeydown={handleDropZoneKeyDown}
                        role="button"
                        tabindex="0"
                    >
                        <input
                            type="file"
                            accept=".car"
                            bind:this={fileInput}
                            onchange={handleFileSelect}
                            hidden
                        />
                        <span>📦 Drop or browse</span>
                    </div>

                    <div class="url-group">
                        <input
                            type="text"
                            bind:value={carUrl}
                            onkeydown={handleKeyDown}
                            placeholder="https://example.com/repo.car"
                            class="mono"
                        />
                        <button
                            onclick={handleUrlFetch}
                            disabled={loadingImport || !carUrl.trim()}
                        >
                            Fetch
                        </button>
                    </div>
                </div>
            {:else}
                <div class="export-controls">
                    <input
                        type="text"
                        bind:value={exportIdentifier}
                        onkeydown={handleKeyDown}
                        placeholder="handle or DID"
                        class="mono"
                    />
                    <button
                        onclick={handleExport}
                        disabled={loadingExport || !exportIdentifier.trim()}
                    >
                        {loadingExport ? "Downloading..." : "Export"}
                    </button>
                </div>
            {/if}
        </div>

        {#if exportProgress}
            <div class="progress-section">
                <div class="progress-bar">
                    <div
                        class="progress-fill"
                        style="width: {exportProgress.total
                            ? (exportProgress.loaded / exportProgress.total) *
                              100
                            : 50}%"
                    ></div>
                </div>
                <p class="progress-text text-3">
                    {formatBytes(exportProgress.loaded)}
                    {#if exportProgress.total}
                        / {formatBytes(exportProgress.total)}
                    {/if}
                </p>
            </div>
        {/if}
    </div>

    {#if importError}
        <ErrorDisplay message={importError} />
    {/if}

    {#if exportError}
        <ErrorDisplay message={exportError} />
    {/if}

    <div class="stream-container">
        {#if activeTab === "import"}
            <div class="stream-header">
                <div class="stat">
                    <span class="stat-value"
                        >{parsedCar?.blocks.length.toLocaleString() ??
                            "—"}</span
                    >
                    <span class="stat-label">Blocks</span>
                </div>
                <div class="stat">
                    <span class="stat-value"
                        >{parsedCar?.records.length.toLocaleString() ??
                            "—"}</span
                    >
                    <span class="stat-label">Records</span>
                </div>
                <div class="stat">
                    <span class="stat-value"
                        >{parsedCar ? formatBytes(totalSize) : "—"}</span
                    >
                    <span class="stat-label">Size</span>
                </div>
                {#if parsedCar}
                    <button class="btn-ghost" onclick={clearCar}>Clear</button>
                {/if}
            </div>

            <div class="content-list">
                {#if loadingImport}
                    <div class="loading-state">
                        <Loader />
                        <p class="text-3 mt-2">Parsing CAR file...</p>
                    </div>
                {:else if parsedCar}
                    <div class="car-content">
                        <div class="blocks-panel">
                            <div class="panel-header">
                                <span class="panel-label">Roots</span>
                            </div>
                            <div class="roots-list">
                                {#each parsedCar.roots as root}
                                    <code class="root-item">{root}</code>
                                {/each}
                            </div>

                            <div class="panel-header">
                                <span class="panel-label">Blocks by Type</span>
                            </div>
                            <div class="block-groups">
                                {#each [...blocksByType.entries()] as [type, blocks]}
                                    <details class="block-group">
                                        <summary>
                                            <span class="group-name"
                                                >{type}</span
                                            >
                                            <span class="badge"
                                                >{blocks.length}</span
                                            >
                                        </summary>

                                        <div class="block-list">
                                            {#each blocks.slice(0, 50) as block}
                                                <button
                                                    class="block-item"
                                                    class:selected={selectedBlock?.cid ===
                                                        block.cid}
                                                    onclick={() =>
                                                        selectBlock(block)}
                                                >
                                                    <code class="block-cid"
                                                        >{truncateCid(
                                                            block.cid,
                                                        )}</code
                                                    >
                                                    <span class="block-size"
                                                        >{formatBytes(
                                                            block.bytes.length,
                                                        )}</span
                                                    >
                                                </button>
                                            {/each}
                                            {#if blocks.length > 50}
                                                <p class="text-3 text-sm p-2">
                                                    ...and {blocks.length - 50} more
                                                </p>
                                            {/if}
                                        </div>
                                    </details>
                                {/each}
                            </div>

                            {#if parsedCar.records.length > 0}
                                <div class="panel-header">
                                    <span class="panel-label">Records</span>
                                    <span class="badge"
                                        >{parsedCar.records.length}</span
                                    >
                                </div>
                                <div class="records-list">
                                    {#each parsedCar.records.slice(0, 100) as record}
                                        <div class="record-item">
                                            <span class="badge"
                                                >{record.collection
                                                    .split(".")
                                                    .pop()}</span
                                            >
                                            <code class="text-xs"
                                                >{truncateCid(
                                                    record.cid,
                                                    20,
                                                )}</code
                                            >
                                        </div>
                                    {/each}
                                    {#if parsedCar.records.length > 100}
                                        <p class="text-3 text-sm p-2">
                                            Showing first 100 of {parsedCar
                                                .records.length} records
                                        </p>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        {#if selectedBlock}
                            <div class="block-detail">
                                <div class="detail-header">
                                    <h3>Block Inspector</h3>
                                    <button
                                        class="btn-ghost"
                                        onclick={() => (selectedBlock = null)}
                                        >Close</button
                                    >
                                </div>

                                <dl class="data-list">
                                    <dt>CID</dt>
                                    <dd>
                                        <code class="break-all"
                                            >{selectedBlock.cid}</code
                                        >
                                    </dd>

                                    <dt>Size</dt>
                                    <dd>
                                        {formatBytes(
                                            selectedBlock.bytes.length,
                                        )}
                                    </dd>

                                    <dt>Type</dt>
                                    <dd>
                                        {getBlockType(selectedBlock.decoded)}
                                    </dd>
                                </dl>

                                <details open class="decoded-data">
                                    <summary>Decoded Data</summary>
                                    <pre class="block-data">{JSON.stringify(
                                            selectedBlock.decoded,
                                            null,
                                            2,
                                        )}</pre>
                                </details>
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="empty-state">
                        <div class="empty-content">
                            <span class="empty-icon">📦</span>
                            <p class="text-2">
                                Drop a CAR file or enter a URL to inspect its
                                contents
                            </p>
                            <p class="text-3">
                                Maximum size: {formatBytes(MAX_CAR_SIZE)}
                            </p>
                        </div>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="stream-header">
                <div class="stat">
                    <span class="stat-value">—</span>
                    <span class="stat-label">Status</span>
                </div>
            </div>

            <div class="content-list">
                <div class="export-content">
                    <div class="export-info">
                        <h3>About CAR Files</h3>
                        <p class="text-2">
                            CAR (Content Addressable aRchive) files are a
                            standard format for packaging IPLD data. In ATProto,
                            they contain the complete Merkle Search Tree (MST)
                            of a repository, including all records and their
                            cryptographic proofs.
                        </p>

                        <h4>Use Cases</h4>
                        <ul class="text-2">
                            <li>Backup your account data</li>
                            <li>Migrate to a different PDS</li>
                            <li>Verify data integrity</li>
                            <li>Analyze repository structure</li>
                        </ul>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .car-tools {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    @media (min-width: 768px) {
        .car-tools {
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

    .import-controls {
        flex: 1;
        display: flex;
        gap: var(--space-2);
        align-items: center;
        flex-wrap: wrap;
    }

    .drop-zone-inline {
        padding: var(--space-1) var(--space-2);
        border: 2px dashed var(--color-border-light);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        transition: all 0.15s ease;
        white-space: nowrap;
    }

    .drop-zone-inline:hover,
    .drop-zone-inline.drag-over {
        border-color: var(--color-accent);
        background: var(--color-accent-light);
    }

    .url-group {
        flex: 1;
        display: flex;
        gap: var(--space-2);
        min-width: 200px;
    }

    .url-group input {
        flex: 1;
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
    }

    .export-controls {
        flex: 1;
        display: flex;
        gap: var(--space-2);
        min-width: 250px;
    }

    .export-controls input {
        flex: 1;
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
    }

    .progress-section {
        margin-top: var(--space-2);
    }

    .progress-bar {
        height: 6px;
        background: var(--color-border-light);
        border-radius: var(--radius-sm);
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--color-accent);
        transition: width 0.2s ease;
    }

    .progress-text {
        margin-top: var(--space-1);
        text-align: center;
        font-size: var(--text-xs);
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
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        height: 100%;
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        height: 100%;
    }

    .empty-content {
        text-align: center;
    }

    .empty-icon {
        font-size: var(--text-2xl);
        display: block;
        margin-bottom: var(--space-2);
    }

    /* CAR content - split panel layout */
    .car-content {
        display: flex;
        height: 100%;
    }

    @media (max-width: 1023px) {
        .car-content {
            flex-direction: column;
        }
    }

    .blocks-panel {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-2);
    }

    @media (min-width: 1024px) {
        .blocks-panel {
            border-right: var(--border-weight) solid var(--color-border-light);
        }
    }

    .panel-header {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        margin-bottom: var(--space-1);
        margin-top: var(--space-2);
    }

    .panel-header:first-child {
        margin-top: 0;
    }

    .panel-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .roots-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .root-item {
        font-size: var(--text-xs);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface-raised);
        border-radius: var(--radius-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .block-groups {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .block-group {
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-subtle);
        border-radius: var(--radius-md);
    }

    .block-group summary {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        cursor: pointer;
        font-weight: var(--weight-medium);
        font-size: var(--text-sm);
    }

    .block-group summary:hover {
        background: var(--color-hover-bg);
    }

    .group-name {
        flex: 1;
    }

    .block-list {
        padding: var(--space-1) var(--space-2);
        border-top: var(--border-weight) solid var(--color-border-subtle);
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
    }

    .block-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-0) var(--space-1);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-subtle);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.15s ease;
        color: var(--color-text);
    }

    .block-item:hover {
        border-color: var(--color-accent);
    }

    .block-item.selected {
        border-color: var(--color-accent);
        background: var(--color-accent-light);
    }

    .block-cid {
        font-size: var(--text-xs);
    }

    .block-size {
        font-size: var(--text-2xs);
        color: var(--color-text-3);
    }

    .records-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .record-item {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-1);
        background: var(--color-surface-raised);
        border-radius: var(--radius-sm);
    }

    .block-detail {
        width: clamp(280px, 28vw, 450px);
        flex-shrink: 0;
        padding: var(--space-2);
        overflow-y: auto;
        background: var(--color-surface);
    }

    @media (max-width: 1023px) {
        .block-detail {
            width: 100%;
            border-top: var(--border-weight) solid var(--color-border-light);
            max-height: 300px;
        }
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-1);
    }

    .detail-header h3 {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
    }

    .data-list {
        font-size: var(--text-sm);
        margin-bottom: var(--space-2);
    }

    .decoded-data summary {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
        cursor: pointer;
        margin-bottom: var(--space-1);
    }

    .block-data {
        font-size: var(--text-xs);
        max-height: 250px;
        overflow: auto;
        background: var(--color-surface-raised);
        padding: var(--space-1);
        border-radius: var(--radius-md);
    }

    /* Export content */
    .export-content {
        padding: var(--space-3);
    }

    .export-info {
        max-width: 600px;
    }

    .export-info h3 {
        font-size: var(--text-base);
        margin-bottom: var(--space-2);
    }

    .export-info h4 {
        font-size: var(--text-sm);
        margin-top: var(--space-3);
        margin-bottom: var(--space-1);
    }

    .export-info ul {
        list-style: disc;
        padding-left: var(--space-3);
    }

    .export-info li {
        margin-bottom: var(--space-0);
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

        .import-controls {
            flex-direction: column;
        }

        .drop-zone-inline {
            width: 100%;
            text-align: center;
            padding: var(--space-2);
        }

        .url-group {
            min-width: 0;
            width: 100%;
        }

        .export-controls {
            min-width: 0;
            flex-direction: column;
        }
    }
</style>
