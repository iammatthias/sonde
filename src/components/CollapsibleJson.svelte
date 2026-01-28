<script lang="ts">
    interface Props {
        data: unknown;
        collapseStringsOver?: number;
        collapseArraysOver?: number;
    }

    let {
        data,
        collapseStringsOver = 500,
        collapseArraysOver = 20,
    }: Props = $props();

    // Track which paths are expanded/collapsed by user
    let userToggled = $state<Map<string, boolean>>(new Map());

    function toggleExpand(path: string, currentlyOpen: boolean) {
        userToggled.set(path, !currentlyOpen);
        userToggled = new Map(userToggled);
    }

    function isLargeString(value: unknown): boolean {
        return typeof value === "string" && value.length > collapseStringsOver;
    }

    function isLargeArray(value: unknown): boolean {
        return Array.isArray(value) && value.length > collapseArraysOver;
    }

    function shouldAutoExpand(path: string, value: unknown): boolean {
        // Always expand root
        if (path === "root") return true;
        // Collapse large arrays
        if (isLargeArray(value)) return false;
        // Expand everything else by default
        return true;
    }

    function isExpanded(path: string, value: unknown): boolean {
        if (userToggled.has(path)) {
            return userToggled.get(path)!;
        }
        return shouldAutoExpand(path, value);
    }

    function formatPrimitive(value: unknown): string {
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (typeof value === "string") return JSON.stringify(value);
        if (typeof value === "number" || typeof value === "boolean")
            return String(value);
        return String(value);
    }

    function truncateString(str: string, max: number): string {
        if (str.length <= max) return str;
        return str.slice(0, max) + "…";
    }
</script>

{#snippet renderValue(value: unknown, path: string, isLast: boolean)}
    {#if value === null || value === undefined || typeof value === "number" || typeof value === "boolean"}
        <span class="primitive {typeof value}">{formatPrimitive(value)}</span
        >{#if !isLast}<span class="punctuation">,</span>{/if}
    {:else if typeof value === "string"}
        {@const large = isLargeString(value)}
        {@const expanded = isExpanded(path, value)}
        {#if large && !expanded}
            <span class="primitive string"
                >"{truncateString(value, collapseStringsOver)}"</span
            >
            <button
                class="collapsed-preview"
                onclick={() => toggleExpand(path, false)}
            >
                {value.length} chars
            </button>{#if !isLast}<span class="punctuation">,</span>{/if}
        {:else}
            <span class="primitive string">{formatPrimitive(value)}</span>
            {#if large}
                <button
                    class="collapse-btn"
                    onclick={() => toggleExpand(path, true)}>collapse</button
                >
            {/if}{#if !isLast}<span class="punctuation">,</span>{/if}
        {/if}
    {:else if Array.isArray(value)}
        {@const size = value.length}
        {@const open = isExpanded(path, value)}
        {#if size === 0}
            <span class="punctuation">[]</span>{#if !isLast}<span
                    class="punctuation">,</span
                >{/if}
        {:else}
            <button
                class="toggle"
                onclick={() => toggleExpand(path, open)}
                aria-expanded={open}
            >
                <span class="toggle-icon">{open ? "▼" : "▶"}</span>
            </button>
            <span class="punctuation">[</span>
            {#if open}
                <div class="indent">
                    {#each value as item, i}
                        <div class="line">
                            {@render renderValue(
                                item,
                                `${path}[${i}]`,
                                i === value.length - 1,
                            )}
                        </div>
                    {/each}
                </div>
                <span class="punctuation">]</span>{#if !isLast}<span
                        class="punctuation">,</span
                    >{/if}
            {:else}
                <button
                    class="collapsed-preview"
                    onclick={() => toggleExpand(path, open)}
                >
                    {size} items
                </button>
                <span class="punctuation">]</span>{#if !isLast}<span
                        class="punctuation">,</span
                    >{/if}
            {/if}
        {/if}
    {:else if typeof value === "object" && value !== null}
        {@const entries = Object.entries(value)}
        {@const size = entries.length}
        {@const open = isExpanded(path, value)}
        {#if size === 0}
            <span class="punctuation">{"{}"}</span>{#if !isLast}<span
                    class="punctuation">,</span
                >{/if}
        {:else}
            <button
                class="toggle"
                onclick={() => toggleExpand(path, open)}
                aria-expanded={open}
            >
                <span class="toggle-icon">{open ? "▼" : "▶"}</span>
            </button>
            <span class="punctuation">{"{"}</span>
            {#if open}
                <div class="indent">
                    {#each entries as [key, val], i}
                        <div class="line">
                            <span class="key">"{key}"</span><span
                                class="punctuation"
                                >:
                            </span>{@render renderValue(
                                val,
                                `${path}.${key}`,
                                i === entries.length - 1,
                            )}
                        </div>
                    {/each}
                </div>
                <span class="punctuation">{"}"}</span>{#if !isLast}<span
                        class="punctuation">,</span
                    >{/if}
            {:else}
                <button
                    class="collapsed-preview"
                    onclick={() => toggleExpand(path, open)}
                >
                    {size}
                    {size === 1 ? "property" : "properties"}
                </button>
                <span class="punctuation">{"}"}</span>{#if !isLast}<span
                        class="punctuation">,</span
                    >{/if}
            {/if}
        {/if}
    {/if}
{/snippet}

<div class="json-viewer">
    {@render renderValue(data, "root", true)}
</div>

<style>
    .json-viewer {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
    }

    .indent {
        padding-left: var(--space-2);
        border-left: var(--border-weight) solid var(--color-border-subtle);
        margin-left: 2px;
    }

    .line {
        display: block;
    }

    .toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        padding: 0;
        margin-right: var(--space-1);
        background: none;
        border: none;
        border-radius: var(--radius-sm);
        color: var(--color-text-3);
        cursor: pointer;
        font-size: var(--text-2xs);
        vertical-align: middle;
        transition:
            background 0.15s ease,
            color 0.15s ease;
    }

    .toggle:hover {
        background: var(--color-hover-bg);
        color: var(--color-text);
    }

    .toggle:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .toggle-icon {
        line-height: var(--leading-none);
    }

    .collapsed-preview {
        display: inline;
        padding: var(--space-0) var(--space-1);
        margin: 0 var(--space-1);
        background: var(--color-accent-light);
        border: var(--border-weight) solid var(--blue-200);
        border-radius: var(--radius-sm);
        color: var(--color-accent-text);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        cursor: pointer;
        transition:
            background 0.15s ease,
            border-color 0.15s ease;
    }

    .collapsed-preview:hover {
        background: var(--blue-200);
        border-color: var(--color-accent);
    }

    .collapsed-preview:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .collapse-btn {
        display: inline;
        padding: var(--space-0) var(--space-1);
        margin-left: var(--space-1);
        background: none;
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-sm);
        color: var(--color-text-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        cursor: pointer;
        transition:
            background 0.15s ease,
            color 0.15s ease;
    }

    .collapse-btn:hover {
        background: var(--color-hover-bg);
        color: var(--color-text);
    }

    .collapse-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .key {
        color: var(--color-accent-text);
    }

    .punctuation {
        color: var(--color-text-3);
    }

    .primitive.string {
        color: var(--color-text);
    }

    .primitive.number {
        color: var(--warm-grey-500);
    }

    .primitive.boolean {
        color: var(--warm-grey-500);
    }

    .primitive.null,
    .primitive.undefined {
        color: var(--warm-grey-400);
    }
</style>
