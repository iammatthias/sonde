<script lang="ts" module>
    function formatTime(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return "Today";
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
        }
    }
</script>

<script lang="ts">
    import {
        getRecentSearches,
        clearRecentSearches,
        type RecentSearch,
    } from "../lib/cache";

    let recents = $state<RecentSearch[]>([]);

    function loadRecents() {
        recents = getRecentSearches();
    }

    function clearHistory() {
        clearRecentSearches();
        recents = [];
    }

    $effect(() => {
        loadRecents();
    });
</script>

<div class="history">
    {#if recents.length === 0}
        <p class="empty">No search history yet.</p>
    {:else}
        <button class="clear-btn" onclick={clearHistory}>Clear history</button>
        <ul class="history-list">
            {#each recents as search (search.did)}
                <li>
                    <a href={`/at/${search.did}`} class="history-item">
                        <span class="handle">@{search.handle}</span>
                        <span class="did">{search.did}</span>
                        <span class="time">{formatTime(search.searchedAt)}</span
                        >
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .history {
        max-width: 600px;
    }

    .empty {
        color: var(--color-text-3);
    }

    .clear-btn {
        display: block;
        margin-bottom: var(--space-3);
        background: none;
        border: var(--border-weight) solid var(--color-border-light);
        color: var(--color-text-3);
        font-size: var(--text-xs);
        padding: var(--space-1) var(--space-2);
    }

    .clear-btn:hover {
        background: var(--warm-grey-100);
        color: var(--color-text);
        border-color: var(--color-border);
    }

    .clear-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    .history-list {
        list-style: none;
    }

    .history-item {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: var(--space-3);
        align-items: baseline;
        padding: var(--space-2) 0;
        border-bottom: var(--border-weight) solid var(--color-border-light);
        font-size: var(--text-sm);
    }

    .history-item:hover {
        background: var(--warm-grey-100);
        box-shadow: inset 2px 0 0 var(--color-text);
    }

    .handle {
        font-weight: var(--weight-medium);
    }

    .did {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
    }

    .time {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        white-space: nowrap;
    }

    @media (max-width: 600px) {
        .history-item {
            grid-template-columns: 1fr auto;
        }

        .did {
            display: none;
        }
    }
</style>
