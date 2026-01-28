<script lang="ts">
    interface Props {
        message?: string;
    }

    let { message = "Loading" }: Props = $props();
</script>

<div class="loading">
    <p>{message}</p>
</div>

<style>
    .loading {
        padding: var(--space-6) 0;
        color: var(--color-text-3);
    }
</style>
