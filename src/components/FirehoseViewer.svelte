<script lang="ts">
    import {
        RELAY_ENDPOINTS,
        DEFAULT_RELAY_ENDPOINT,
        buildFirehoseUrl,
        parseFirehoseEvent,
        formatCommitEvent,
        getActionColor,
        getMessageTypeName,
        getOperationNavigationPath,
        truncateDid,
        formatBytes,
        type ParsedFirehoseEvent,
    } from "../lib/firehose";
    import {
        createReconnectingWebSocket,
        EventBuffer,
        MAX_EVENTS,
        formatEventsPerSecond,
        formatBytesPerSecond,
    } from "../lib/websocket";
    import Loader from "./Loader.svelte";

    // Connection state
    let connected = $state(false);
    let connecting = $state(false);
    let error = $state<string | null>(null);
    let paused = $state(false);

    // Configuration
    let selectedEndpoint = $state(DEFAULT_RELAY_ENDPOINT);
    let customEndpoint = $state("");
    let useCustomEndpoint = $state(false);

    // Event state
    let eventBuffer = new EventBuffer<ParsedFirehoseEvent>(MAX_EVENTS);
    let events = $state<ParsedFirehoseEvent[]>([]);
    let eventCount = $state(0);
    let totalBytes = $state(0);

    // Throttled rendering - limits UI updates to prevent frame drops
    const RENDER_INTERVAL_MS = 100; // Update UI max 10 times/second
    const MAX_VISIBLE_EVENTS = 100; // Only render recent events
    let lastRenderTime = 0;
    let renderScheduled = false;

    // Stats
    let eventsPerSecond = $state(0);
    let bytesPerSecond = $state(0);
    let lastSecondEventCount = 0;
    let lastSecondBytes = 0;
    let statsInterval: ReturnType<typeof setInterval> | null = null;

    // WebSocket controller
    let wsController: ReturnType<typeof createReconnectingWebSocket> | null =
        null;

    // Auto-scroll
    let eventListEl: HTMLDivElement;
    let autoScroll = $state(true);

    // Selected event for detail view
    let selectedEvent = $state<ParsedFirehoseEvent | null>(null);

    // Throttled render function
    function scheduleRender() {
        if (renderScheduled) return;

        const now = performance.now();
        const timeSinceLastRender = now - lastRenderTime;

        if (timeSinceLastRender >= RENDER_INTERVAL_MS) {
            // Can render immediately
            doRender();
        } else {
            // Schedule render after remaining time
            renderScheduled = true;
            setTimeout(() => {
                renderScheduled = false;
                doRender();
            }, RENDER_INTERVAL_MS - timeSinceLastRender);
        }
    }

    function doRender() {
        lastRenderTime = performance.now();
        // Only get recent events to minimize DOM updates
        events = eventBuffer.getRecent(MAX_VISIBLE_EVENTS);

        // Auto-scroll
        if (autoScroll && eventListEl) {
            requestAnimationFrame(() => {
                eventListEl.scrollTop = eventListEl.scrollHeight;
            });
        }
    }

    function connect() {
        if (wsController) {
            wsController.disconnect();
        }

        error = null;
        connecting = true;

        const endpoint = useCustomEndpoint
            ? customEndpoint.trim()
            : selectedEndpoint;
        const url = buildFirehoseUrl(endpoint);

        wsController = createReconnectingWebSocket(url, {
            binaryType: "arraybuffer",
            onMessage: async (data) => {
                if (paused) return;

                const event = await parseFirehoseEvent(data as ArrayBuffer);
                if (event) {
                    eventBuffer.push(event);
                    eventCount++;
                    totalBytes += event.size;

                    // Throttled render instead of immediate update
                    scheduleRender();
                }
            },
            onOpen: () => {
                connected = true;
                connecting = false;
                startStatsTracking();
            },
            onClose: () => {
                connected = false;
                connecting = false;
                stopStatsTracking();
            },
            onError: () => {
                error = "Connection error. Retrying...";
            },
        });

        wsController.connect();
    }

    function disconnect() {
        if (wsController) {
            wsController.disconnect();
            wsController = null;
        }
        connected = false;
        connecting = false;
        stopStatsTracking();
    }

    function togglePause() {
        paused = !paused;
    }

    function clearEvents() {
        eventBuffer.clear();
        events = [];
        eventCount = 0;
        totalBytes = 0;
        selectedEvent = null;
    }

    function startStatsTracking() {
        lastSecondEventCount = eventCount;
        lastSecondBytes = totalBytes;
        statsInterval = setInterval(() => {
            eventsPerSecond = eventCount - lastSecondEventCount;
            bytesPerSecond = totalBytes - lastSecondBytes;
            lastSecondEventCount = eventCount;
            lastSecondBytes = totalBytes;
        }, 1000);
    }

    function stopStatsTracking() {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        eventsPerSecond = 0;
        bytesPerSecond = 0;
    }

    function handleScroll() {
        if (!eventListEl) return;
        const { scrollTop, scrollHeight, clientHeight } = eventListEl;
        autoScroll = scrollHeight - scrollTop - clientHeight < 100;
    }

    function selectEvent(event: ParsedFirehoseEvent) {
        selectedEvent = selectedEvent?.seq === event.seq ? null : event;
    }

    // Cleanup
    $effect(() => {
        return () => {
            disconnect();
        };
    });
</script>

<div class="firehose-viewer">
    <header class="page-header">
        <div class="header-main">
            <h1>Firehose</h1>
            <p class="text-2">Raw ATProto relay event stream</p>
        </div>
        <div class="connection-status">
            {#if connected}
                <span class="status-dot connected"></span>
                <span>Connected</span>
            {:else if connecting}
                <span class="status-dot connecting"></span>
                <span>Connecting...</span>
            {:else}
                <span class="status-dot disconnected"></span>
                <span>Disconnected</span>
            {/if}
        </div>
    </header>

    <div class="controls card">
        <div class="control-row">
            <div class="control-group endpoint-group">
                <label class="control-label" for="firehose-endpoint"
                    >Relay Endpoint</label
                >
                <div class="endpoint-select">
                    <select
                        id="firehose-endpoint"
                        bind:value={selectedEndpoint}
                        disabled={connected || useCustomEndpoint}
                    >
                        {#each RELAY_ENDPOINTS as endpoint}
                            <option value={endpoint.url}
                                >{endpoint.label}</option
                            >
                        {/each}
                    </select>
                    <label class="custom-toggle">
                        <input
                            id="firehose-custom-toggle"
                            type="checkbox"
                            bind:checked={useCustomEndpoint}
                            disabled={connected}
                        />
                        Custom
                    </label>
                </div>
            </div>

            {#if useCustomEndpoint}
                <div class="control-group custom-endpoint">
                    <label class="control-label" for="firehose-custom-url"
                        >Custom URL</label
                    >
                    <input
                        id="firehose-custom-url"
                        type="text"
                        bind:value={customEndpoint}
                        placeholder="wss://custom-relay.example"
                        disabled={connected}
                        class="mono"
                    />
                </div>
            {/if}

            <div class="control-group control-buttons">
                {#if connected}
                    <button onclick={disconnect}>Disconnect</button>
                {:else}
                    <button onclick={connect} disabled={connecting}>
                        {connecting ? "Connecting..." : "Connect"}
                    </button>
                {/if}
            </div>
        </div>

        <p class="warning-text">
            ⚠️ The firehose produces a high volume of binary data. Performance
            may vary.
        </p>
    </div>

    {#if error}
        <div class="error-banner">
            {error}
        </div>
    {/if}

    <div class="stream-container">
        <div class="stream-header">
            <span class="stat">
                <span class="stat-value">{eventCount.toLocaleString()}</span>
                <span class="stat-label">events</span>
            </span>
            <span class="stat">
                <span class="stat-value"
                    >{formatEventsPerSecond(eventsPerSecond)}</span
                >
                <span class="stat-label">rate</span>
            </span>
            <span class="stat">
                <span class="stat-value"
                    >{formatBytesPerSecond(bytesPerSecond)}</span
                >
                <span class="stat-label">throughput</span>
            </span>
            <span class="stat">
                <span class="stat-value">{formatBytes(totalBytes)}</span>
                <span class="stat-label">total</span>
            </span>
            <div class="stream-controls">
                <button
                    class="btn-ghost"
                    onclick={togglePause}
                    disabled={!connected}
                >
                    {paused ? "▶ Resume" : "⏸ Pause"}
                </button>
                <button class="btn-ghost" onclick={clearEvents}> Clear </button>
                <label class="auto-scroll-toggle">
                    <input type="checkbox" bind:checked={autoScroll} />
                    Auto-scroll
                </label>
            </div>
        </div>

        <div class="stream-content">
            <div
                class="event-list"
                bind:this={eventListEl}
                onscroll={handleScroll}
            >
                {#if events.length === 0}
                    <div class="empty-state">
                        {#if connected}
                            <Loader />
                            <p class="text-3 mt-2">Waiting for events...</p>
                        {:else}
                            <p class="text-3">
                                Connect to start receiving events
                            </p>
                        {/if}
                    </div>
                {:else}
                    {#each events as event, index (event.seq + "-" + index)}
                        {@const formatted = event.commit
                            ? formatCommitEvent(event.commit)
                            : null}

                        <button
                            class="event-item"
                            class:selected={selectedEvent?.seq === event.seq}
                            onclick={() => selectEvent(event)}
                        >
                            <div class="event-seq mono">{event.seq}</div>
                            <div class="event-type">
                                <span class="badge"
                                    >{getMessageTypeName(event.type)}</span
                                >
                            </div>
                            <div class="event-repo mono">
                                {#if event.repo}
                                    <a
                                        href="/at/{event.repo}"
                                        onclick={(e) => e.stopPropagation()}
                                    >
                                        {truncateDid(event.repo)}
                                    </a>
                                {:else}
                                    —
                                {/if}
                            </div>
                            <div class="event-ops">
                                {#if formatted}
                                    {#each formatted.operations.slice(0, 3) as op}
                                        {@const navPath = event.repo
                                            ? getOperationNavigationPath(
                                                  event.repo,
                                                  {
                                                      action: op.action,
                                                      path: `${op.collection}/${op.rkey}`,
                                                  },
                                              )
                                            : null}
                                        <span
                                            class="op-badge"
                                            class:action-create={op.action ===
                                                "create"}
                                            class:action-update={op.action ===
                                                "update"}
                                            class:action-delete={op.action ===
                                                "delete"}
                                        >
                                            {#if navPath && op.action !== "delete"}
                                                <a
                                                    href={navPath}
                                                    onclick={(e) =>
                                                        e.stopPropagation()}
                                                >
                                                    {op.action}
                                                    {op.collection
                                                        .split(".")
                                                        .pop()}
                                                </a>
                                            {:else}
                                                {op.action}
                                                {op.collection.split(".").pop()}
                                            {/if}
                                        </span>
                                    {/each}
                                    {#if formatted.operations.length > 3}
                                        <span class="op-more"
                                            >+{formatted.operations.length -
                                                3}</span
                                        >
                                    {/if}
                                {/if}
                            </div>
                            <div class="event-size text-3">
                                {formatBytes(event.size)}
                            </div>
                        </button>
                    {/each}
                {/if}
            </div>

            {#if selectedEvent}
                <div class="event-detail">
                    <div class="detail-header">
                        <h3>Event Details</h3>
                        <button
                            class="btn-ghost"
                            onclick={() => (selectedEvent = null)}>×</button
                        >
                    </div>

                    <dl class="data-list">
                        <dt>Sequence</dt>
                        <dd class="mono">{selectedEvent.seq}</dd>

                        <dt>Type</dt>
                        <dd>{getMessageTypeName(selectedEvent.type)}</dd>

                        <dt>Time</dt>
                        <dd>{selectedEvent.timestamp.toLocaleString()}</dd>

                        <dt>Size</dt>
                        <dd>{formatBytes(selectedEvent.size)}</dd>

                        {#if selectedEvent.repo}
                            <dt>Repo</dt>
                            <dd>
                                <a
                                    href="/at/{selectedEvent.repo}"
                                    class="mono break-all"
                                >
                                    {selectedEvent.repo}
                                </a>
                            </dd>
                        {/if}
                    </dl>

                    {#if selectedEvent.commit}
                        {@const commit = selectedEvent.commit}
                        <div class="commit-detail">
                            <h4>Commit</h4>

                            <dl class="data-list">
                                <dt>Rev</dt>
                                <dd class="mono">{commit.rev}</dd>

                                {#if commit.blocks}
                                    <dt>Blocks</dt>
                                    <dd>{formatBytes(commit.blocks.length)}</dd>
                                {/if}

                                <dt>Operations</dt>
                                <dd>
                                    <div class="ops-list">
                                        {#each commit.ops as op}
                                            {@const [collection, rkey] =
                                                op.path.split("/")}
                                            {@const navPath =
                                                getOperationNavigationPath(
                                                    commit.repo,
                                                    op,
                                                )}
                                            <div class="op-item">
                                                <span
                                                    class="op-badge {getActionColor(
                                                        op.action,
                                                    )}"
                                                >
                                                    {op.action}
                                                </span>
                                                {#if navPath && op.action !== "delete"}
                                                    <a
                                                        href={navPath}
                                                        class="mono"
                                                    >
                                                        {collection}/{rkey}
                                                    </a>
                                                {:else}
                                                    <span class="mono"
                                                        >{op.path}</span
                                                    >
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </dd>
                            </dl>
                        </div>
                    {/if}

                    <details class="raw-frame">
                        <summary>Raw Frame</summary>
                        <pre>{JSON.stringify(
                                selectedEvent.raw,
                                (key, value) => {
                                    // Convert Uint8Array to array for display
                                    if (value instanceof Uint8Array) {
                                        return `[Uint8Array: ${value.length} bytes]`;
                                    }
                                    return value;
                                },
                                2,
                            )}</pre>
                    </details>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .firehose-viewer {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    @media (min-width: 768px) {
        .firehose-viewer {
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

    .connection-status {
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

    .status-dot.connected {
        background: var(--color-success);
        box-shadow: 0 0 10px var(--color-success);
    }

    .status-dot.connecting {
        background: var(--color-warning);
        animation: pulse 1s infinite;
    }

    .status-dot.disconnected {
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
        align-items: flex-end;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .endpoint-group {
        min-width: 200px;
    }

    .custom-endpoint {
        flex: 1;
        min-width: 200px;
    }

    .control-buttons {
        justify-content: flex-end;
    }

    .control-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .endpoint-select {
        display: flex;
        gap: var(--space-2);
        align-items: center;
    }

    .custom-toggle {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-2);
        cursor: pointer;
        white-space: nowrap;
    }

    .controls select {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        color: var(--color-text);
        cursor: pointer;
    }

    .controls select:focus {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .controls select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .controls input {
        font-size: var(--text-sm);
        padding: var(--space-1) var(--space-2);
    }

    .warning-text {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        margin-top: var(--space-2);
    }

    .error-banner {
        padding: var(--space-2) var(--space-3);
        background: var(--color-error-light);
        border: var(--border-weight) solid var(--color-error);
        border-radius: var(--radius-md);
        color: var(--color-error);
        font-size: var(--text-sm);
        flex-shrink: 0;
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
        flex-wrap: wrap;
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

    .stream-controls {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .auto-scroll-toggle {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-2);
        cursor: pointer;
    }

    .stream-content {
        flex: 1;
        display: flex;
        min-height: 0;
    }

    .event-list {
        flex: 1;
        overflow-y: auto;
    }

    @media (min-width: 768px) {
        .event-list {
            min-height: 0;
        }
    }

    @media (max-width: 767px) {
        .event-list {
            max-height: 60vh;
        }
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-4);
        height: 100%;
    }

    .event-item {
        display: grid;
        grid-template-columns: 70px 70px 1fr 2fr 50px;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        font-size: var(--text-sm);
        align-items: center;
        width: 100%;
        text-align: left;
        background: none;
        border-left: none;
        border-right: none;
        border-top: none;
        cursor: pointer;
        transition: background 0.15s ease;
        color: var(--color-text);
    }

    .event-item:hover {
        background: var(--color-hover-bg);
    }

    .event-item.selected {
        background: var(--color-accent-light);
    }

    .event-seq {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .event-repo {
        font-size: var(--text-xs);
        color: var(--color-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .event-repo a {
        color: inherit;
        border-bottom: none;
    }

    .event-repo a:hover {
        color: var(--color-accent-text);
    }

    .event-ops {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
    }

    .op-badge {
        font-size: var(--text-2xs);
        padding: var(--space-px) var(--space-1);
        border-radius: var(--radius-sm);
        background: var(--warm-grey-100);
        color: var(--color-text);
    }

    .op-badge a {
        color: inherit;
        border-bottom: none;
    }

    .op-more {
        font-size: var(--text-2xs);
        color: var(--color-text-3);
    }

    .event-size {
        font-size: var(--text-xs);
        text-align: right;
    }

    /* Event detail */
    .event-detail {
        width: clamp(300px, 25vw, 450px);
        border-left: var(--border-weight) solid var(--color-border-light);
        overflow-y: auto;
        padding: var(--space-3);
        flex-shrink: 0;
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-3);
    }

    .detail-header h3 {
        font-size: var(--text-base);
        font-weight: var(--weight-medium);
    }

    .commit-detail {
        margin-top: var(--space-3);
        padding-top: var(--space-3);
        border-top: var(--border-weight) solid var(--color-border-light);
    }

    .commit-detail h4 {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        margin-bottom: var(--space-2);
    }

    .ops-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .op-item {
        display: flex;
        align-items: center;
        gap: var(--space-1);
    }

    .op-item .mono {
        font-size: var(--text-xs);
        word-break: break-all;
    }

    .raw-frame {
        margin-top: var(--space-3);
    }

    .raw-frame summary {
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
        cursor: pointer;
    }

    .raw-frame pre {
        font-size: var(--text-xs);
        max-height: 300px;
        overflow: auto;
        margin-top: var(--space-1);
    }

    /* Responsive */
    @media (max-width: 1023px) {
        .event-detail {
            display: none;
        }
    }

    @media (max-width: 767px) {
        .event-item {
            grid-template-columns: 1fr;
            gap: var(--space-0);
            padding: var(--space-2) var(--space-3);
        }

        .stream-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-2);
        }

        .stream-controls {
            width: 100%;
            justify-content: space-between;
        }

        .control-row {
            flex-direction: column;
            align-items: stretch;
        }

        .control-group {
            width: 100%;
        }

        .endpoint-group,
        .custom-endpoint {
            min-width: 0;
        }

        .control-buttons {
            align-items: stretch;
        }

        .control-buttons button {
            width: 100%;
        }

        .endpoint-select {
            flex-direction: column;
            align-items: stretch;
        }

        .endpoint-select select {
            width: 100%;
        }

        .auto-scroll-toggle {
            display: none;
        }
    }
</style>
