<script lang="ts">
    import { normalizeIdentifier, isDid, isHandle } from "../lib/identity";
    import { getRecentSearches, type RecentSearch } from "../lib/cache";

    let value = $state("");
    let focused = $state(false);
    let recents = $state<RecentSearch[]>([]);

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
        const normalized = normalizeIdentifier(value);
        if (!validate(normalized)) return;
        window.location.href = `/at/${normalized}`;
    }

    function handleFocus() {
        loadRecents();
        focused = true;
    }

    function handleBlur() {
        setTimeout(() => {
            focused = false;
        }, 150);
    }

    function selectRecent(search: RecentSearch) {
        window.location.href = `/at/${search.did}`;
    }

    const showDropdown = $derived(
        focused && recents.length > 0 && value === "",
    );
</script>

<form
    class="search form-compact"
    role="search"
    aria-label="Search for handle or DID"
    onsubmit={handleSubmit}
>
    <div class="search-wrapper">
        <div class="search-bar" class:focused>
            <svg
                width="14"
                height="14"
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
            <label for="header-search" class="visually-hidden"
                >Search by handle or DID</label
            >
            <input
                id="header-search"
                type="text"
                bind:value
                onfocus={handleFocus}
                onblur={handleBlur}
                placeholder="@handle or DID"
            />
            <button
                type="submit"
                aria-label="Submit search"
                disabled={!value.trim()}>Go</button
            >
        </div>

        {#if showDropdown}
            <div class="dropdown">
                <div class="dropdown-label">Recent</div>
                {#each recents.slice(0, 5) as search}
                    <button
                        type="button"
                        class="dropdown-item"
                        onmousedown={() => selectRecent(search)}
                    >
                        @{search.handle}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</form>

<style>
    .search {
        flex: 1;
        min-width: 100px;
        max-width: 200px;
    }

    @media (min-width: 480px) {
        .search {
            max-width: 260px;
        }
    }

    @media (min-width: 768px) {
        .search {
            max-width: 320px;
        }
    }

    @media (min-width: 1440px) {
        .search {
            max-width: 400px;
        }
    }

    .search-wrapper {
        position: relative;
    }

    /* Search bar with icon, input, and button inside */
    .search-bar {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0) var(--space-0) var(--space-0) var(--space-1);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .search-bar.focused {
        border-color: var(--color-accent);
        box-shadow:
            var(--shadow-sm),
            0 0 0 3px var(--color-accent-light);
    }

    .search-bar svg {
        flex-shrink: 0;
        color: var(--color-text-3);
    }

    .search-bar input {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        font-family: var(--font-mono);
        font-size: var(--text-sm); /* Compact for header */
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

    /* Dropdown */
    .dropdown {
        position: absolute;
        top: calc(100% + var(--space-1));
        left: 0;
        right: 0;
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        z-index: 100;
        box-shadow: var(--shadow-lg);
        overflow: hidden;
    }

    .dropdown-label {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-3);
        padding: var(--space-1) var(--space-2);
        border-bottom: var(--border-weight) solid var(--color-border-light);
        background: var(--color-surface-raised);
    }

    .dropdown-item {
        display: block;
        width: 100%;
        padding: var(--space-2) var(--space-2);
        background: none;
        border: none;
        border-radius: 0;
        text-align: left;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
        color: var(--color-text);
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .dropdown-item + .dropdown-item {
        border-top: var(--border-weight) solid var(--color-border-subtle);
    }

    .dropdown-item:hover {
        background: var(--color-hover-bg);
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
        .search-bar {
            padding: 0 0 0 var(--space-0);
            gap: var(--space-0);
        }

        .search-bar svg {
            width: 12px;
            height: 12px;
        }

        .search-bar input {
            font-size: var(--text-xs);
        }

        .search-bar button {
            padding: var(--space-0);
            font-size: var(--text-2xs);
        }

        .dropdown-label {
            padding: var(--space-0) var(--space-1);
        }

        .dropdown-item {
            padding: var(--space-1) var(--space-1);
            font-size: var(--text-xs);
        }
    }
</style>
