<script lang="ts">
    import type { DID } from "../lib/types";
    import {
        detectEncoding,
        decodeValue,
        bytesToUtf8,
        bytesToHex,
        isBase64,
        decodeBase64,
    } from "../lib/decode";
    import { getBlobUrl, tidToDate } from "../lib/records";
    import {
        parseMarkdownSync,
        preloadMarked,
        isLikelyMarkdown,
    } from "../lib/markdown";
    import JsonTree from "./JsonTree.svelte";
    import VirtualList from "./VirtualList.svelte";

    interface Props {
        value: unknown;
        pdsEndpoint: string;
        did: DID;
        path?: string;
        depth?: number;
    }

    let { value, pdsEndpoint, did, path = "", depth = 0 }: Props = $props();

    const encoding = $derived(detectEncoding(value));
    const decoded = $derived(decodeValue(value, path));

    // Threshold for virtualizing arrays
    const VIRTUALIZE_THRESHOLD = 50;

    // Check if an array looks like a byte array (numbers 0-255, reasonably long)
    function isLikelyByteArray(arr: unknown[]): boolean {
        if (arr.length < 10) return false; // Too short to be confident
        // Check first 100 elements to avoid performance issues on huge arrays
        const sample = arr.slice(0, 100);
        return sample.every(
            (v) =>
                typeof v === "number" &&
                Number.isInteger(v) &&
                v >= 0 &&
                v <= 255,
        );
    }

    // Decode byte array to UTF-8 if possible
    function decodeByteArray(arr: number[]): {
        text: string | null;
        hex: string;
    } {
        const bytes = new Uint8Array(arr);
        const text = bytesToUtf8(bytes);
        const hex = bytesToHex(bytes.slice(0, 64)); // First 64 bytes as hex
        return { text, hex };
    }

    // Decode base64 string to UTF-8 if possible
    function decodeBase64String(str: string): {
        text: string | null;
        hex: string;
        bytes: Uint8Array;
    } {
        const bytes = decodeBase64(str);
        const text = bytesToUtf8(bytes);
        const hex = bytesToHex(bytes.slice(0, 64));
        return { text, hex, bytes };
    }

    // Render markdown to HTML (uses lazy-loaded, memoized parser)
    function renderMarkdown(text: string): string {
        return parseMarkdownSync(text);
    }

    function isImageMimeType(mimeType: string): boolean {
        return mimeType.startsWith("image/");
    }

    // Maximum blob size to auto-load (5MB)
    const MAX_AUTO_LOAD_BLOB_SIZE = 5 * 1024 * 1024;

    // Check if blob should auto-load
    function shouldAutoLoadBlob(size: number): boolean {
        return size <= MAX_AUTO_LOAD_BLOB_SIZE;
    }

    // State for blob loading
    let blobLoadStates = $state<
        Record<string, "pending" | "loading" | "loaded" | "error">
    >({});

    function formatDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    }

    // State for expanding collapsed content and view modes
    let showFullBytes = $state(false);
    let showFullBase64 = $state(false);
    let markdownView = $state<"rendered" | "source">("rendered");
    let showAllItems = $state(false);

    // Preload markdown when component mounts (if we might need it)
    $effect(() => {
        // Preload marked if this looks like it might have markdown
        if (typeof value === "string" && value.length > 50) {
            preloadMarked();
        }
    });
</script>

{#if value === null}
    <span class="null">null</span>
{:else if value === undefined}
    <span class="null">undefined</span>
{:else if typeof value === "string"}
    {#if decoded.isNavigable}
        <a href={decoded.navigateTo} class="link">{value}</a>
    {:else if encoding === "datetime"}
        <span class="string" title={formatDate(value)}>{value}</span>
    {:else if isBase64(value) && value.length >= 20}
        {@const base64Result = decodeBase64String(value)}
        <div class="base64-data">
            <div class="data-header">
                <span class="badge">base64</span>
                <span class="size"
                    >{base64Result.bytes.length} bytes decoded</span
                >
                {#if base64Result.text}
                    <span class="badge decoded">UTF-8</span>
                    {#if isLikelyMarkdown(base64Result.text)}
                        <span class="badge markdown">Markdown</span>
                    {/if}
                {/if}
            </div>
            {#if base64Result.text}
                {@const isMd = isLikelyMarkdown(base64Result.text)}
                {#if isMd}
                    <div class="view-toggle">
                        <button
                            class="toggle-btn"
                            class:active={markdownView === "rendered"}
                            onclick={() => (markdownView = "rendered")}
                        >
                            Rendered
                        </button>
                        <button
                            class="toggle-btn"
                            class:active={markdownView === "source"}
                            onclick={() => (markdownView = "source")}
                        >
                            Source
                        </button>
                    </div>
                {/if}
                <div class="data-content">
                    {#if isMd && markdownView === "rendered"}
                        <div class="markdown-content">
                            {@html renderMarkdown(base64Result.text)}
                        </div>
                    {:else}
                        <pre class="decoded-text">{showFullBase64 ||
                            base64Result.text.length <= 500
                                ? base64Result.text
                                : base64Result.text.slice(0, 500) + "..."}</pre>
                        {#if base64Result.text.length > 500 && !showFullBase64}
                            <button
                                class="expand-btn"
                                onclick={() => (showFullBase64 = true)}
                            >
                                Show all ({base64Result.text.length} chars)
                            </button>
                        {/if}
                    {/if}
                </div>
            {:else}
                <div class="data-content hex">
                    <code
                        >{base64Result.hex}{base64Result.bytes.length > 64
                            ? "..."
                            : ""}</code
                    >
                </div>
            {/if}
        </div>
    {:else if isLikelyMarkdown(value) && value.length > 50}
        <div class="markdown-data">
            <div class="data-header">
                <span class="badge markdown">Markdown</span>
                <span class="size">{value.length} chars</span>
                <div class="view-toggle">
                    <button
                        class="toggle-btn"
                        class:active={markdownView === "rendered"}
                        onclick={() => (markdownView = "rendered")}
                    >
                        Rendered
                    </button>
                    <button
                        class="toggle-btn"
                        class:active={markdownView === "source"}
                        onclick={() => (markdownView = "source")}
                    >
                        Source
                    </button>
                </div>
            </div>
            <div class="data-content">
                {#if markdownView === "rendered"}
                    <div class="markdown-content">
                        {@html renderMarkdown(value)}
                    </div>
                {:else}
                    <pre class="decoded-text">{value}</pre>
                {/if}
            </div>
        </div>
    {:else}
        <span class="string">"{value}"</span>
    {/if}
{:else if typeof value === "number"}
    <span class="number">{value}</span>
{:else if typeof value === "boolean"}
    <span class="boolean">{String(value)}</span>
{:else if Array.isArray(value)}
    {#if value.length === 0}
        <span class="bracket">[]</span>
    {:else if isLikelyByteArray(value)}
        {@const byteResult = decodeByteArray(value as number[])}
        {@const isMdBytes = byteResult.text
            ? isLikelyMarkdown(byteResult.text)
            : false}
        <div class="byte-array">
            <div class="data-header">
                <span class="badge">bytes</span>
                <span class="size">{value.length} bytes</span>
                {#if byteResult.text}
                    <span class="badge decoded">UTF-8</span>
                    {#if isMdBytes}
                        <span class="badge markdown">Markdown</span>
                    {/if}
                {/if}
            </div>
            {#if byteResult.text}
                {#if isMdBytes}
                    <div class="view-toggle">
                        <button
                            class="toggle-btn"
                            class:active={markdownView === "rendered"}
                            onclick={() => (markdownView = "rendered")}
                        >
                            Rendered
                        </button>
                        <button
                            class="toggle-btn"
                            class:active={markdownView === "source"}
                            onclick={() => (markdownView = "source")}
                        >
                            Source
                        </button>
                    </div>
                {/if}
                <div class="data-content">
                    {#if isMdBytes && markdownView === "rendered"}
                        <div class="markdown-content">
                            {@html renderMarkdown(byteResult.text)}
                        </div>
                    {:else}
                        <pre class="decoded-text">{showFullBytes ||
                            byteResult.text.length <= 500
                                ? byteResult.text
                                : byteResult.text.slice(0, 500) + "..."}</pre>
                        {#if byteResult.text.length > 500 && !showFullBytes}
                            <button
                                class="expand-btn"
                                onclick={() => (showFullBytes = true)}
                            >
                                Show all ({byteResult.text.length} chars)
                            </button>
                        {/if}
                    {/if}
                </div>
            {:else}
                <div class="data-content hex">
                    <code>{byteResult.hex}{value.length > 64 ? "..." : ""}</code
                    >
                </div>
            {/if}
        </div>
    {:else if value.length > VIRTUALIZE_THRESHOLD && !showAllItems}
        <!-- Large array: show virtualized or collapsed view -->
        <div class="array large-array" class:nested={depth > 0}>
            <div class="array-info">
                <span class="badge">{value.length} items</span>
                <button
                    class="expand-btn"
                    onclick={() => (showAllItems = true)}
                >
                    Show all
                </button>
            </div>
            <VirtualList
                items={value}
                itemHeight={32}
                containerHeight={Math.min(400, value.length * 32)}
            >
                {#snippet children({ item, index })}
                    <div class="array-item">
                        <span class="index">[{index}]</span>
                        <JsonTree
                            value={item}
                            {pdsEndpoint}
                            {did}
                            path={`${path}[${index}]`}
                            depth={depth + 1}
                        />
                    </div>
                {/snippet}
            </VirtualList>
        </div>
    {:else}
        <div class="array" class:nested={depth > 0}>
            {#if showAllItems && value.length > VIRTUALIZE_THRESHOLD}
                <button
                    class="collapse-btn"
                    onclick={() => (showAllItems = false)}
                >
                    Collapse ({value.length} items)
                </button>
            {/if}
            {#each value as item, index}
                <div class="array-item">
                    <span class="index">[{index}]</span>
                    <JsonTree
                        value={item}
                        {pdsEndpoint}
                        {did}
                        path={`${path}[${index}]`}
                        depth={depth + 1}
                    />
                </div>
            {/each}
        </div>
    {/if}
{:else if typeof value === "object"}
    {@const obj = value as Record<string, unknown>}

    {#if obj.$type === "blob" && obj.ref}
        {@const blob = obj as {
            ref: { $link: string };
            mimeType: string;
            size: number;
        }}
        {@const blobUrl = getBlobUrl(pdsEndpoint, did, blob.ref.$link)}
        {@const autoLoad = shouldAutoLoadBlob(blob.size)}
        {@const loadState =
            blobLoadStates[blob.ref.$link] ??
            (autoLoad ? "loading" : "pending")}
        <div class="blob">
            <div class="blob-meta">
                <span class="badge">{blob.mimeType}</span>
                <span class="size">{Math.round(blob.size / 1024)}KB</span>
                {#if blob.size > MAX_AUTO_LOAD_BLOB_SIZE}
                    <span class="badge warning">Large file</span>
                {/if}
            </div>
            {#if isImageMimeType(blob.mimeType)}
                {#if loadState === "pending"}
                    <button
                        class="blob-load-btn"
                        onclick={() => {
                            blobLoadStates = {
                                ...blobLoadStates,
                                [blob.ref.$link]: "loading",
                            };
                        }}
                    >
                        Load image ({Math.round(blob.size / 1024)}KB)
                    </button>
                {:else}
                    <img
                        src={blobUrl}
                        alt="Blob"
                        class="blob-image"
                        loading="lazy"
                        onload={() => {
                            blobLoadStates = {
                                ...blobLoadStates,
                                [blob.ref.$link]: "loaded",
                            };
                        }}
                        onerror={() => {
                            blobLoadStates = {
                                ...blobLoadStates,
                                [blob.ref.$link]: "error",
                            };
                        }}
                    />
                    {#if loadState === "error"}
                        <span class="blob-error">Failed to load image</span>
                    {/if}
                {/if}
            {:else}
                <a
                    href={blobUrl}
                    target="_blank"
                    rel="noopener"
                    class="blob-download"
                >
                    Download
                </a>
            {/if}
        </div>
    {:else if obj.uri && obj.cid && typeof obj.uri === "string" && obj.uri.startsWith("at://")}
        <!-- Strong ref -->
        <div class="strong-ref">
            <a href={`/at/${(obj.uri as string).replace("at://", "")}`}
                >{obj.uri}</a
            >
            <span class="cid">{obj.cid}</span>
        </div>
    {:else}
        {@const entries = Object.entries(obj)}
        {#if entries.length === 0}
            <span class="bracket">{"{}"}</span>
        {:else}
            <div class="object" class:nested={depth > 0}>
                {#each entries as [key, val]}
                    <span class="key">{key}</span>
                    <span class="value">
                        <JsonTree
                            value={val}
                            {pdsEndpoint}
                            {did}
                            path={path ? `${path}.${key}` : key}
                            depth={depth + 1}
                        />
                    </span>
                {/each}
            </div>
        {/if}
    {/if}
{/if}

<style>
    .null {
        color: var(--warm-grey-400);
    }
    .string {
        color: var(--color-text);
    }
    .number {
        color: var(--warm-grey-500);
        font-family: var(--font-mono);
    }
    .boolean {
        color: var(--warm-grey-500);
    }
    .bracket {
        color: var(--color-text-3);
    }

    .link {
        font-family: var(--font-mono);
        word-break: break-all;
    }

    /* Object container - grid for proper key/value alignment */
    .object {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-0) var(--space-2);
        align-items: start;
    }

    .array {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .nested {
        padding-left: var(--space-2);
        margin-left: var(--space-0);
        border-left: 2px solid var(--color-border-light);
        margin-top: var(--space-0);
    }

    /* Object fields - key on left, value on right */
    .key {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--warm-grey-600);
        white-space: nowrap;
        padding: var(--space-1) 0;
    }

    .value {
        font-size: var(--text-sm);
        word-break: break-word;
        padding: var(--space-1) 0;
        min-width: 0; /* Allow text truncation in grid */
    }

    /* Array items - index badge + content */
    .array-item {
        display: flex;
        align-items: start;
        gap: var(--space-2);
        padding: var(--space-1) 0;
        font-size: var(--text-sm);
    }

    .index {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        background: var(--warm-grey-100);
        padding: var(--space-0) var(--space-1);
        border-radius: var(--radius-sm);
        flex-shrink: 0;
    }

    /* Blob */
    .blob {
        display: inline-flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
    }

    .blob-meta {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .badge {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: var(--space-0) var(--space-1);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
    }

    .size {
        font-size: var(--text-xs);
        color: var(--color-text-3);
    }

    .blob-image {
        max-width: 300px;
        max-height: 200px;
        display: block;
    }

    .blob-download {
        font-size: var(--text-sm);
    }

    .blob-load-btn {
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--color-accent-text);
        background: var(--color-accent-light);
        border: var(--border-weight) solid var(--blue-200);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
    }

    .blob-load-btn:hover {
        background: var(--blue-200);
        border-color: var(--color-accent);
    }

    .blob-load-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .blob-error {
        font-size: var(--text-xs);
        color: var(--color-error);
        margin-top: var(--space-1);
    }

    .badge.warning {
        background: var(--color-warning-light);
        color: var(--color-warning-dark);
        border-color: var(--color-warning);
    }

    /* Strong ref */
    .strong-ref {
        display: flex;
        flex-direction: column;
        gap: var(--space-0);
    }

    .strong-ref a {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        word-break: break-all;
    }

    .cid {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        word-break: break-all;
    }

    /* Unified data containers (byte-array, base64-data, markdown-data) */
    .byte-array,
    .base64-data,
    .markdown-data {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2);
        background: var(--color-surface-raised);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
    }

    .data-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
    }

    .data-header .decoded {
        background: var(--color-surface);
        color: var(--color-text-2);
        border-color: var(--color-border-light);
    }

    .data-header .markdown {
        background: var(--color-accent);
        color: var(--white);
        border-color: var(--color-accent);
    }

    .data-content {
        margin-top: var(--space-2);
    }

    .data-content.hex code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        word-break: break-all;
    }

    .decoded-text {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        padding: var(--space-2);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        max-height: 400px;
        overflow: auto;
    }

    .expand-btn {
        margin-top: var(--space-2);
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--color-accent-text);
        background: var(--color-accent-light);
        border: var(--border-weight) solid var(--blue-200);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
    }

    .expand-btn:hover {
        background: var(--blue-200);
        border-color: var(--color-accent);
    }

    .expand-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .collapse-btn {
        margin-bottom: var(--space-2);
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--color-text-2);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
    }

    .collapse-btn:hover {
        background: var(--color-hover-bg);
        border-color: var(--color-border);
    }

    .collapse-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .large-array {
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        padding: var(--space-2);
        background: var(--color-surface);
    }

    .array-info {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
        padding-bottom: var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    /* View toggle for markdown */
    .view-toggle {
        display: flex;
        gap: 0;
        margin-top: var(--space-2);
    }

    .toggle-btn {
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        color: var(--color-text-2);
        cursor: pointer;
        transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
    }

    .toggle-btn:first-child {
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    }

    .toggle-btn:last-child {
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        border-left: none;
    }

    .toggle-btn:hover:not(.active) {
        background: var(--color-hover-bg);
        color: var(--color-text);
    }

    .toggle-btn.active {
        background: var(--color-accent);
        color: var(--white);
        border-color: var(--color-accent);
    }

    .toggle-btn.active:hover {
        background: var(--blue-600);
    }

    .toggle-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    /* Markdown rendered content */
    .markdown-content {
        padding: var(--space-2);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        max-height: 500px;
        overflow: auto;
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
    }

    .markdown-content :global(h1),
    .markdown-content :global(h2),
    .markdown-content :global(h3),
    .markdown-content :global(h4),
    .markdown-content :global(h5),
    .markdown-content :global(h6) {
        margin-top: var(--space-3);
        margin-bottom: var(--space-2);
        font-weight: var(--weight-semibold);
    }

    .markdown-content :global(h1) {
        font-size: var(--text-base);
    }

    .markdown-content :global(h2) {
        font-size: var(--text-sm);
    }

    .markdown-content :global(h3),
    .markdown-content :global(h4),
    .markdown-content :global(h5),
    .markdown-content :global(h6) {
        font-size: var(--text-sm);
    }

    .markdown-content :global(p) {
        margin-bottom: var(--space-2);
    }

    .markdown-content :global(ul),
    .markdown-content :global(ol) {
        margin-bottom: var(--space-2);
        padding-left: var(--space-4);
    }

    .markdown-content :global(li) {
        margin-bottom: var(--space-1);
    }

    .markdown-content :global(code) {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: var(--space-0) var(--space-0);
        background: var(--warm-grey-100);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
    }

    .markdown-content :global(pre) {
        margin-bottom: var(--space-2);
        padding: var(--space-2);
        background: var(--warm-grey-100);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
        overflow-x: auto;
    }

    .markdown-content :global(pre code) {
        padding: 0;
        background: none;
        border: none;
    }

    .markdown-content :global(blockquote) {
        margin: var(--space-2) 0;
        padding-left: var(--space-3);
        border-left: 3px solid var(--color-border);
        color: var(--color-text-3);
    }

    .markdown-content :global(a) {
        color: var(--color-text);
        text-decoration: underline;
    }

    .markdown-content :global(a:hover) {
        text-decoration: none;
    }

    .markdown-content :global(hr) {
        margin: var(--space-3) 0;
        border: none;
        border-top: var(--border-weight) solid var(--color-border-light);
    }

    .markdown-content :global(table) {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: var(--space-2);
    }

    .markdown-content :global(th),
    .markdown-content :global(td) {
        padding: var(--space-1) var(--space-2);
        border: var(--border-weight) solid var(--color-border-light);
        text-align: left;
    }

    .markdown-content :global(th) {
        background: var(--warm-grey-100);
        font-weight: var(--weight-semibold);
    }
</style>
