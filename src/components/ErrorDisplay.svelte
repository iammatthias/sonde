<script lang="ts">
    interface Props {
        error: string;
        onRetry?: () => void;
    }

    let { error, onRetry }: Props = $props();
</script>

<div class="error">
    <p>{error}</p>
    {#if onRetry}
        <button class="secondary mt-2" onclick={onRetry}>Retry</button>
    {/if}
</div>

<style>
    .error {
        padding: var(--space-4);
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border);
    }

    .error p {
        color: var(--color-text-2);
    }
</style>
