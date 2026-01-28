<script lang="ts">
    import { normalizeIdentifier, isDid, isHandle } from "../lib/identity";
    import { getRecentSearches, type RecentSearch } from "../lib/cache";

    let value = $state("");
    let recents = $state<RecentSearch[]>([]);
    let error = $state<string | null>(null);

    function loadRecents() {
        recents = getRecentSearches();
    }

    function validate(input: string): boolean {
        const normalized = normalizeIdentifier(input);
        if (!normalized) return false;
        return isDid(normalized) || isHandle(normalized);
    }

    function handleSubmit(e: Event) {
        e.preventDefault();
        error = null;

        const trimmed = value.trim();
        if (!trimmed) {
            error = "Please enter a handle or DID";
            return;
        }

        const normalized = normalizeIdentifier(trimmed);
        if (!validate(normalized)) {
            error =
                "Invalid format. Enter a handle (e.g., alice.bsky.social) or DID";
            return;
        }

        window.location.href = `/at/${normalized}`;
    }

    function handleInput() {
        // Clear error when user starts typing
        if (error) error = null;
    }

    $effect(() => {
        loadRecents();
    });
</script>

<div class="home">
    <header class="hero">
        <p>
            Explore ATProto. Browse records, decode data, and follow references
            across the network.
        </p>
    </header>

    <form class="search" onsubmit={handleSubmit} role="search">
        <div class="search-bar">
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
            >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
            </svg>
            <label for="home-search" class="visually-hidden"
                >Search by handle or DID</label
            >
            <input
                id="home-search"
                type="text"
                bind:value
                oninput={handleInput}
                placeholder="@alice.bsky.social or did:plc:..."
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "home-search-error" : undefined}
            />
            <button type="submit" class="btn-accent" disabled={!value.trim()}>
                Explore
            </button>
        </div>
        {#if error}
            <p id="home-search-error" class="search-error" role="alert">
                {error}
            </p>
        {/if}
    </form>

    {#if recents.length > 0}
        <section class="recents">
            <h3>Recent</h3>
            <div class="recents-list">
                {#each recents.slice(0, 3) as search}
                    <a href={`/at/${search.did}`} class="recent-item">
                        <span class="handle">@{search.handle}</span>
                        <span class="did">{search.did}</span>
                    </a>
                {/each}
            </div>
            {#if recents.length > 3}
                <a href="/history" class="history-link">View all →</a>
            {/if}
        </section>
    {/if}
</div>

<style>
    .home {
        max-width: 560px;
    }

    .hero {
        margin-bottom: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }
    /* Search bar with shadow and focus glow */
    .search {
        margin-bottom: var(--space-3);
    }

    .search-bar {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .search-bar:focus-within {
        border-color: var(--color-accent);
        box-shadow:
            var(--shadow-md),
            0 0 0 3px var(--color-accent-light);
    }

    .search-bar svg {
        flex-shrink: 0;
        color: var(--color-text-3);
    }

    .search-bar input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: var(--text-base);
        color: var(--color-text);
        outline: none;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
    }

    .search-bar input:focus {
        box-shadow: none;
    }

    .search-bar input::placeholder {
        color: var(--color-text-3);
    }

    .search-bar button {
        flex-shrink: 0;
    }

    .search-error {
        margin-top: var(--space-1);
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-error-dark);
        background: var(--color-error-light);
        border: var(--border-weight) solid var(--color-error);
        border-radius: var(--radius-md);
    }

    /* Recents */
    .recents {
        margin-bottom: var(--space-4);
    }

    .recents h3 {
        margin-bottom: var(--space-1);
    }

    .recents-list {
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    .recent-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
        font-size: var(--text-sm);
        color: inherit;
        border-bottom: none;
        transition: background 0.15s ease;
    }

    .recent-item:hover {
        background: var(--color-hover-bg);
    }

    .recent-item + .recent-item {
        border-top: var(--border-weight) solid var(--color-border-subtle);
    }

    .recent-item .handle {
        font-weight: var(--weight-medium);
        color: var(--color-text);
    }

    .recent-item .did {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .history-link {
        display: inline-block;
        margin-top: var(--space-1);
        font-size: var(--text-sm);
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
        .hero {
            margin-bottom: var(--space-2);
            gap: var(--space-1);
        }

        .hero p {
            font-size: var(--text-sm);
        }

        .search-bar {
            padding: var(--space-0) var(--space-1);
            gap: var(--space-0);
        }

        .search-bar svg {
            width: 16px;
            height: 16px;
        }

        .search-bar input {
            min-width: 0;
            font-size: var(--text-sm);
        }

        .search-bar button {
            padding: var(--space-0) var(--space-1);
            font-size: var(--text-xs);
        }

        .recent-item {
            padding: var(--space-0) var(--space-1);
            font-size: var(--text-xs);
        }

        .recent-item .did {
            display: none;
        }
    }
</style>
