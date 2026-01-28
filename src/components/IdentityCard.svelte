<script lang="ts">
    import type { ResolvedIdentity } from "../lib/types";

    interface Props {
        identity: ResolvedIdentity;
        showDetails?: boolean;
    }

    let { identity, showDetails = false }: Props = $props();
    let copied = $state(false);

    async function copyDid() {
        try {
            await navigator.clipboard.writeText(identity.did);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = identity.did;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        }
    }

    function getPdsHost(endpoint: string): string {
        try {
            return new URL(endpoint).host;
        } catch {
            return endpoint;
        }
    }
</script>

<header class="identity">
    <h1>@{identity.handle}</h1>

    <dl class="data-list mt-3">
        <dt>DID</dt>
        <dd class="did-row">
            <span class="did">{identity.did}</span>
            <button class="copy" onclick={copyDid}>
                {copied ? "Copied" : "Copy"}
            </button>
        </dd>

        <dt>PDS</dt>
        <dd>
            <a href={identity.pdsEndpoint} target="_blank" rel="noopener">
                {getPdsHost(identity.pdsEndpoint)}
            </a>
        </dd>

        <dt>Method</dt>
        <dd><span class="badge">{identity.did.split(":")[1]}</span></dd>
    </dl>

    {#if showDetails}
        <details class="doc-details mt-4">
            <summary>
                <span class="summary-icon">▶</span>
                DID Document
            </summary>
            <div class="doc-content">
                <pre>{JSON.stringify(identity.didDocument, null, 2)}</pre>
            </div>
        </details>
    {/if}
</header>

<style>
    .identity {
        padding-bottom: var(--space-4);
        border-bottom: var(--border-weight-heavy) solid var(--color-border);
    }

    .did-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
    }

    .did {
        word-break: break-all;
    }

    .copy {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 0;
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-3);
    }

    .copy:hover {
        background: none;
        color: var(--color-text);
    }

    .doc-details {
        background: var(--color-surface);
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        overflow: hidden;
    }

    .doc-details summary {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--weight-semibold);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-3);
        cursor: pointer;
        padding: var(--space-2) var(--space-3);
        transition:
            background 0.15s ease,
            color 0.15s ease;
        list-style: none;
    }

    .doc-details summary::-webkit-details-marker {
        display: none;
    }

    .doc-details summary:hover {
        background: var(--color-hover-bg);
        color: var(--color-text);
    }

    .doc-details summary:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 3px var(--color-accent-light);
    }

    .summary-icon {
        font-size: var(--text-2xs);
        transition: transform 0.15s ease;
    }

    .doc-details[open] .summary-icon {
        transform: rotate(90deg);
    }

    .doc-details[open] summary {
        border-bottom: var(--border-weight) solid var(--color-border-light);
    }

    .doc-content {
        padding: var(--space-3);
        background: var(--color-surface-raised);
    }

    .doc-details pre {
        font-size: var(--text-xs);
        max-height: 300px;
        overflow: auto;
        margin: 0;
        padding: 0;
        background: none;
        border: none;
        border-radius: 0;
    }
</style>
