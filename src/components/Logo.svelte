<script lang="ts">
    interface Props {
        size?: "sm" | "md" | "lg" | "xl";
        showWordmark?: boolean;
        showTld?: boolean;
    }

    let {
        size = "md",
        showWordmark = false,
        showTld = false,
    }: Props = $props();

    const sizes = {
        sm: { icon: 20, height: 25, wordmark: "var(--text-sm)" },
        md: { icon: 28, height: 34, wordmark: "var(--text-lg)" },
        lg: { icon: 36, height: 44, wordmark: "var(--text-xl)" },
        xl: { icon: 48, height: 60, wordmark: "var(--text-2xl)" },
    };

    const s = $derived(sizes[size]);
</script>

<div class="logo" class:with-wordmark={showWordmark}>
    <svg
        width={s.icon}
        height={s.height}
        viewBox="0 0 48 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Sonde logo"
        class="logo-svg"
    >
        <!-- Balloon body -->
        <circle cx="24" cy="16" r="14" class="logo-fill" />
        <!-- Highlight -->
        <circle cx="18" cy="11" r="5" class="logo-highlight" />
        <!-- Neck connector -->
        <path d="M21 29 L24 33 L27 29" class="logo-fill" />
        <!-- String -->
        <path
            d="M24 33 Q26 40 24 47"
            class="logo-stroke"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
        />
        <!-- Payload -->
        <rect x="18" y="48" width="12" height="9" rx="2" class="logo-fill" />
    </svg>

    {#if showWordmark}
        <span class="wordmark" style:font-size={s.wordmark}>
            sonde{#if showTld}<span class="tld">.blue</span>{/if}
        </span>
    {/if}
</div>

<style>
    .logo {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
    }

    /* SVG colors using CSS variables */
    .logo-svg :global(.logo-fill) {
        fill: var(--color-accent);
    }

    .logo-svg :global(.logo-highlight) {
        fill: var(--blue-400);
        opacity: 0.6;
    }

    .logo-svg :global(.logo-stroke) {
        stroke: var(--color-accent);
    }

    .wordmark {
        font-weight: var(--weight-semibold);
        letter-spacing: -0.01em;
        color: var(--color-text);
    }

    .tld {
        color: var(--color-accent);
    }
</style>
