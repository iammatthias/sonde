<script lang="ts">
    interface Props {
        type?: "balloon" | "ping";
        size?: "sm" | "md" | "lg";
        text?: string;
    }

    let { type = "balloon", size = "md", text = "" }: Props = $props();

    const sizes = {
        sm: { balloon: 28, ping: 24 },
        md: { balloon: 40, ping: 40 },
        lg: { balloon: 56, ping: 56 },
    };

    const s = $derived(sizes[size]);
</script>

<div class="loader">
    {#if type === "balloon"}
        <svg
            width={s.balloon}
            height={s.balloon * 1.25}
            viewBox="0 0 48 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="loader-float"
            aria-label="Loading"
        >
            <!-- Balloon body -->
            <circle cx="24" cy="16" r="14" class="balloon-fill" />
            <!-- Highlight -->
            <circle cx="18" cy="11" r="5" class="balloon-highlight" />
            <!-- Neck connector -->
            <path d="M21 29 L24 33 L27 29" class="balloon-fill" />
            <!-- String -->
            <path
                d="M24 33 Q26 40 24 47"
                class="balloon-stroke"
                stroke-width="2"
                stroke-linecap="round"
                fill="none"
            />
            <!-- Payload -->
            <rect
                x="18"
                y="48"
                width="12"
                height="9"
                rx="2"
                class="balloon-fill"
            />
        </svg>
    {:else}
        <svg
            width={s.ping}
            height={s.ping}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Loading"
        >
            <!-- Center dot -->
            <circle cx="24" cy="24" r="4" class="balloon-fill" />
            <!-- Ping ring 1 -->
            <circle
                cx="24"
                cy="24"
                r="8"
                class="balloon-stroke ping-ring"
                stroke-width="2"
                fill="none"
            />
            <!-- Ping ring 2 (delayed) -->
            <circle
                cx="24"
                cy="24"
                r="8"
                class="balloon-stroke ping-ring delayed"
                stroke-width="2"
                fill="none"
            />
        </svg>
    {/if}

    {#if text}
        <span class="loader-text">{text}</span>
    {/if}
</div>

<style>
    .loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
    }

    .loader-text {
        font-size: var(--text-sm);
        color: var(--color-text-3);
    }

    /* SVG colors using CSS variables */
    :global(.balloon-fill) {
        fill: var(--color-accent);
    }

    :global(.balloon-highlight) {
        fill: var(--blue-400);
        opacity: 0.6;
    }

    :global(.balloon-stroke) {
        stroke: var(--color-accent);
    }

    /* Float animation for balloon */
    .loader-float {
        animation: float 2.5s ease-in-out infinite;
    }

    @keyframes float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-4px);
        }
    }

    /* Ping animation for rings */
    .ping-ring {
        animation: ping 1.5s ease-out infinite;
    }

    .ping-ring.delayed {
        animation-delay: 0.5s;
    }

    @keyframes ping {
        0% {
            r: 6;
            opacity: 0.8;
        }
        100% {
            r: 18;
            opacity: 0;
        }
    }
</style>
