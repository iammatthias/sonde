<script lang="ts">
    import type { Snippet } from "svelte";

    /**
     * VirtualList - A lightweight virtualized list for rendering large datasets.
     * Only renders items visible in the viewport plus a small buffer.
     */

    interface Props {
        items: unknown[];
        itemHeight: number;
        containerHeight?: number;
        bufferSize?: number;
        children: Snippet<[{ item: unknown; index: number }]>;
    }

    let {
        items,
        itemHeight,
        containerHeight = 400,
        bufferSize = 5,
        children,
    }: Props = $props();

    let scrollTop = $state(0);
    let containerEl: HTMLDivElement;

    // Calculate visible range
    const totalHeight = $derived(items.length * itemHeight);

    const startIndex = $derived(
        Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize),
    );

    const endIndex = $derived(
        Math.min(
            items.length,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize,
        ),
    );

    const visibleItems = $derived(
        items.slice(startIndex, endIndex).map((item, i) => ({
            item,
            index: startIndex + i,
            style: `position: absolute; top: ${(startIndex + i) * itemHeight}px; width: 100%;`,
        })),
    );

    function handleScroll() {
        if (containerEl) {
            scrollTop = containerEl.scrollTop;
        }
    }
</script>

<div
    class="virtual-list-container"
    style="height: {containerHeight}px;"
    bind:this={containerEl}
    onscroll={handleScroll}
>
    <div class="virtual-list-spacer" style="height: {totalHeight}px;">
        {#each visibleItems as { item, index, style } (index)}
            <div {style} class="virtual-list-item">
                {@render children({ item, index })}
            </div>
        {/each}
    </div>
</div>

<style>
    .virtual-list-container {
        overflow-y: auto;
        position: relative;
    }

    .virtual-list-spacer {
        position: relative;
    }

    .virtual-list-item {
        box-sizing: border-box;
    }
</style>
