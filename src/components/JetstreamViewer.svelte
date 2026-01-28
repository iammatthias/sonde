<script lang="ts">
    import type { JetstreamEvent } from "../lib/types";
    import {
        JETSTREAM_ENDPOINTS,
        DEFAULT_JETSTREAM_ENDPOINT,
        COMMON_COLLECTIONS,
        buildJetstreamUrl,
        parseJetstreamEvent,
        formatJetstreamEvent,
        getEventTypeColor,
        getOperationColor,
        isNavigableEvent,
        getEventNavigationPath,
        extractPostText,
        truncateDid,
        jetstreamTimestampToDate,
    } from "../lib/jetstream";
    import {
        createReconnectingWebSocket,
        EventBuffer,
        MAX_EVENTS,
        formatEventsPerSecond,
    } from "../lib/websocket";
    import { resolveToDidString, isDid } from "../lib/identity";
    import Loader from "./Loader.svelte";

    // Connection state
    let connected = $state(false);
    let connecting = $state(false);
    let error = $state<string | null>(null);
    let paused = $state(false);

    // Configuration
    let selectedEndpoint = $state(DEFAULT_JETSTREAM_ENDPOINT);
    let selectedCollections = $state<string[]>([]);
    let didFilter = $state("");

    // Event state
    let eventBuffer = new EventBuffer<JetstreamEvent>(MAX_EVENTS);
    let events = $state<JetstreamEvent[]>([]);
    let eventCount = $state(0);
    let eventsPerSecond = $state(0);

    // Throttled rendering - limits UI updates to prevent frame drops
    const RENDER_INTERVAL_MS = 100; // Update UI max 10 times/second
    const MAX_VISIBLE_EVENTS = 100; // Only render recent events
    let lastRenderTime = 0;
    let renderScheduled = false;

    // Stats tracking
    let lastSecondCount = 0;
    let statsInterval: ReturnType<typeof setInterval> | null = null;

    // WebSocket controller
    let wsController: ReturnType<typeof createReconnectingWebSocket> | null =
        null;

    // Auto-scroll
    let eventListEl: HTMLDivElement;
    let autoScroll = $state(true);

    // Throttled render function
    function scheduleRender() {
        if (renderScheduled) return;

        const now = performance.now();
        const timeSinceLastRender = now - lastRenderTime;

        if (timeSinceLastRender >= RENDER_INTERVAL_MS) {
            doRender();
        } else {
            renderScheduled = true;
            setTimeout(() => {
                renderScheduled = false;
                doRender();
            }, RENDER_INTERVAL_MS - timeSinceLastRender);
        }
    }

    function doRender() {
        lastRenderTime = performance.now();
        events = eventBuffer.getRecent(MAX_VISIBLE_EVENTS);

        if (autoScroll && eventListEl) {
            requestAnimationFrame(() => {
                eventListEl.scrollTop = eventListEl.scrollHeight;
            });
        }
    }

    async function connect() {
        if (wsController) {
            wsController.disconnect();
        }

        error = null;
        connecting = true;

        // Resolve handle to DID if needed
        let resolvedDid: string | undefined;
        if (didFilter.trim()) {
            try {
                resolvedDid = await resolveToDidString(didFilter.trim());
            } catch (e) {
                error =
                    e instanceof Error
                        ? e.message
                        : "Failed to resolve identifier";
                connecting = false;
                return;
            }
        }

        const options = {
            wantedCollections:
                selectedCollections.length > 0
                    ? selectedCollections
                    : undefined,
            wantedDids: resolvedDid ? [resolvedDid] : undefined,
        };

        const url = buildJetstreamUrl(selectedEndpoint, options);

        wsController = createReconnectingWebSocket(url, {
            onMessage: (data) => {
                if (paused) return;

                const event = parseJetstreamEvent(data as string);
                if (event) {
                    eventBuffer.push(event);
                    eventCount++;
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
    }

    function startStatsTracking() {
        lastSecondCount = eventCount;
        statsInterval = setInterval(() => {
            eventsPerSecond = eventCount - lastSecondCount;
            lastSecondCount = eventCount;
        }, 1000);
    }

    function stopStatsTracking() {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
        eventsPerSecond = 0;
    }

    function toggleCollection(collection: string) {
        if (selectedCollections.includes(collection)) {
            selectedCollections = selectedCollections.filter(
                (c) => c !== collection,
            );
        } else {
            selectedCollections = [...selectedCollections, collection];
        }
    }

    function handleScroll() {
        if (!eventListEl) return;
        const { scrollTop, scrollHeight, clientHeight } = eventListEl;
        // Auto-scroll is on if we're within 100px of bottom
        autoScroll = scrollHeight - scrollTop - clientHeight < 100;
    }

    // Cleanup on component destroy
    $effect(() => {
        return () => {
            disconnect();
        };
    });
</script>

<div class="jetstream-viewer">
    <header class="page-header">
        <div class="header-main">
            <h1>Jetstream</h1>
            <p class="text-2">Real-time ATProto event stream</p>
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
            <div class="control-group">
                <label class="control-label" for="jetstream-endpoint"
                    >Endpoint</label
                >
                <select
                    id="jetstream-endpoint"
                    bind:value={selectedEndpoint}
                    disabled={connected}
                >
                    {#each JETSTREAM_ENDPOINTS as endpoint}
                        <option value={endpoint.url}>{endpoint.label}</option>
                    {/each}
                </select>
            </div>

            <div class="control-group">
                <label class="control-label" for="jetstream-did-filter"
                    >DID Filter</label
                >
                <input
                    id="jetstream-did-filter"
                    type="text"
                    bind:value={didFilter}
                    placeholder="@handle or did:plc:..."
                    disabled={connected}
                    class="mono"
                />
            </div>

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

        <div class="filter-row">
            <label class="control-label">Collections</label>
            <div class="collection-filters">
                {#each COMMON_COLLECTIONS as collection}
                    <button
                        class="filter-chip"
                        class:active={selectedCollections.includes(
                            collection.value,
                        )}
                        onclick={() => toggleCollection(collection.value)}
                        disabled={connected}
                    >
                        {collection.label}
                    </button>
                {/each}
            </div>
        </div>
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
                <span class="stat-value">{events.length}</span>
                <span class="stat-label">in buffer</span>
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

        <div class="event-list" bind:this={eventListEl} onscroll={handleScroll}>
            {#if events.length === 0}
                <div class="empty-state">
                    {#if connected}
                        <Loader />
                        <p class="text-3 mt-2">Waiting for events...</p>
                    {:else}
                        <p class="text-3">Connect to start receiving events</p>
                    {/if}
                </div>
            {:else}
                {#each events as event, index (event.time_us + "-" + index)}
                    {@const formatted = formatJetstreamEvent(event)}
                    {@const navigable = isNavigableEvent(event)}
                    {@const navPath = getEventNavigationPath(event)}
                    {@const postText = extractPostText(event)}
                    {@const timestamp = jetstreamTimestampToDate(event.time_us)}

                    <div class="event-item" class:navigable>
                        <div class="event-time">
                            {timestamp.toLocaleTimeString()}
                        </div>
                        <div class="event-badges">
                            <span
                                class="badge {getEventTypeColor(
                                    formatted.type,
                                )}"
                            >
                                {formatted.type}
                            </span>
                            {#if formatted.action}
                                <span
                                    class="badge {getOperationColor(
                                        formatted.action,
                                    )}"
                                >
                                    {formatted.action}
                                </span>
                            {/if}
                        </div>
                        <div class="event-did mono">
                            <a href="/at/{event.did}"
                                >{truncateDid(event.did)}</a
                            >
                        </div>
                        <div class="event-summary">
                            {#if navigable && navPath}
                                <a href={navPath} class="event-link">
                                    {formatted.summary}
                                </a>
                            {:else}
                                {formatted.summary}
                            {/if}
                            {#if postText}
                                <span class="post-preview"
                                    >{postText.slice(0, 100)}{postText.length >
                                    100
                                        ? "..."
                                        : ""}</span
                                >
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    .jetstream-viewer {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    @media (min-width: 768px) {
        .jetstream-viewer {
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
        margin-bottom: var(--space-2);
        align-items: flex-end;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .control-group:first-child {
        min-width: 150px;
    }

    .control-group:nth-child(2) {
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

    .filter-row {
        padding-top: var(--space-2);
        border-top: var(--border-weight) solid var(--color-border-light);
    }

    .filter-row .control-label {
        margin-bottom: var(--space-1);
    }

    .collection-filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
    }

    .filter-chip {
        font-size: var(--text-xs);
        padding: var(--space-0) var(--space-2);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        color: var(--color-text-2);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .filter-chip:hover:not(:disabled) {
        border-color: var(--color-accent);
        color: var(--color-accent-text);
    }

    .filter-chip.active {
        background: var(--color-accent-light);
        border-color: var(--color-accent);
        color: var(--color-accent-text);
    }

    .filter-chip:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
        grid-template-columns: 70px auto 1fr 2fr;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-subtle);
        font-size: var(--text-sm);
        align-items: center;
    }

    .event-item:hover {
        background: var(--color-hover-bg);
    }

    .event-item.navigable {
        cursor: pointer;
    }

    .event-time {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .event-badges {
        display: flex;
        gap: var(--space-1);
    }

    .event-did {
        font-size: var(--text-xs);
        color: var(--color-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .event-did a {
        color: inherit;
        border-bottom: none;
    }

    .event-did a:hover {
        color: var(--color-accent-text);
    }

    .event-summary {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
        min-width: 0;
    }

    .event-link {
        color: var(--color-text);
        border-bottom: none;
    }

    .event-link:hover {
        color: var(--color-accent-text);
    }

    .post-preview {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Operation colors */
    :global(.op-create) {
        background: var(--color-success-light) !important;
        color: var(--color-success-dark) !important;
        border-color: var(--color-success) !important;
    }

    :global(.op-update) {
        background: var(--color-warning-light) !important;
        color: var(--color-warning-dark) !important;
        border-color: var(--color-warning) !important;
    }

    :global(.op-delete) {
        background: var(--color-error-light) !important;
        color: var(--color-error-dark) !important;
        border-color: var(--color-error) !important;
    }

    /* Responsive */
    @media (max-width: 767px) {
        .event-item {
            grid-template-columns: 1fr;
            gap: var(--space-0);
            padding: var(--space-2) var(--space-3);
        }

        .event-time {
            order: -1;
        }

        .event-summary,
        .event-did {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .post-preview {
            display: none;
        }

        .stream-header {
            flex-direction: column;
            align-items: flex-start;
            flex-wrap: wrap;
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

        .control-group:first-child,
        .control-group:nth-child(2) {
            min-width: 0;
        }

        .control-buttons {
            align-items: stretch;
        }

        .control-buttons button {
            width: 100%;
        }

        .auto-scroll-toggle {
            display: none;
        }
    }
</style>
