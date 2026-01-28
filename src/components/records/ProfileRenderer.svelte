<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";
    import { getBlobUrl } from "../../lib/records";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();

    // Type the profile record value
    interface ProfileRecord {
        displayName?: string;
        description?: string;
        avatar?: { ref: { $link: string }; mimeType: string };
        banner?: { ref: { $link: string }; mimeType: string };
        createdAt?: string;
        labels?: any;
    }

    const profile = $derived(record.value as ProfileRecord);

    // Get avatar/banner URLs
    const avatarUrl = $derived(
        profile.avatar
            ? getBlobUrl(pdsEndpoint, did, profile.avatar.ref.$link)
            : null,
    );
    const bannerUrl = $derived(
        profile.banner
            ? getBlobUrl(pdsEndpoint, did, profile.banner.ref.$link)
            : null,
    );

    // Extract handle from DID (simplified - would need resolution for actual handle)
    function formatDid(did: string): string {
        if (did.startsWith("did:plc:")) {
            return did.slice(0, 16) + "..." + did.slice(-4);
        }
        return did;
    }
</script>

<div class="profile-card">
    <!-- Banner -->
    {#if bannerUrl}
        <div class="banner">
            <img src={bannerUrl} alt="" loading="lazy" />
        </div>
    {/if}

    <div class="profile-content">
        <!-- Avatar and identity -->
        <div class="identity-row">
            {#if avatarUrl}
                <img src={avatarUrl} alt="" class="avatar" loading="lazy" />
            {:else}
                <div class="avatar-placeholder"></div>
            {/if}

            <div class="identity-info">
                <h2 class="display-name">
                    {profile.displayName || formatDid(did)}
                </h2>
                <span class="did mono">{did}</span>
            </div>
        </div>

        <!-- Bio -->
        {#if profile.description}
            <p class="bio">{profile.description}</p>
        {/if}

        <!-- Metadata -->
        <dl class="profile-meta">
            <div class="meta-item">
                <dt>DID</dt>
                <dd class="mono">{did}</dd>
            </div>
            <div class="meta-item">
                <dt>PDS</dt>
                <dd class="mono">{new URL(pdsEndpoint).hostname}</dd>
            </div>
            {#if profile.createdAt}
                <div class="meta-item">
                    <dt>Created</dt>
                    <dd>{new Date(profile.createdAt).toLocaleDateString()}</dd>
                </div>
            {/if}
        </dl>
    </div>
</div>

<style>
    .profile-card {
        border: var(--border-weight) solid var(--color-border-light);
        border-radius: var(--radius-lg);
        background: var(--color-surface);
        overflow: hidden;
    }

    .banner {
        height: 120px;
        overflow: hidden;
        background: var(--warm-grey-200);
    }

    .banner img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .profile-content {
        padding: var(--space-2);
    }

    .identity-row {
        display: flex;
        gap: var(--space-2);
        align-items: flex-start;
        margin-top: -40px;
    }

    .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: 3px solid var(--color-surface);
        background: var(--warm-grey-200);
        object-fit: cover;
        flex-shrink: 0;
    }

    .avatar-placeholder {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: 3px solid var(--color-surface);
        background: var(--warm-grey-300);
        flex-shrink: 0;
    }

    .identity-info {
        padding-top: 44px;
        min-width: 0;
    }

    .display-name {
        font-size: var(--text-base);
        font-weight: var(--weight-semibold);
        margin: 0;
        line-height: var(--leading-snug);
    }

    .did {
        font-size: var(--text-xs);
        color: var(--color-text-3);
        word-break: break-all;
    }

    .bio {
        margin-top: var(--space-2);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        white-space: pre-wrap;
        word-break: break-word;
    }

    .profile-meta {
        margin-top: var(--space-2);
        padding-top: var(--space-2);
        border-top: var(--border-weight) solid var(--color-border-subtle);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }

    .meta-item {
        display: grid;
        grid-template-columns: 60px 1fr;
        gap: var(--space-1);
        font-size: var(--text-xs);
    }

    .meta-item dt {
        font-weight: var(--weight-semibold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-3);
    }

    .meta-item dd {
        word-break: break-all;
    }
</style>
