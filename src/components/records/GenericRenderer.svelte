<script lang="ts">
    import type { RepoRecord, DID } from "../../lib/types";
    import JsonTree from "../JsonTree.svelte";

    interface Props {
        record: RepoRecord;
        pdsEndpoint: string;
        did: DID;
    }

    let { record, pdsEndpoint, did }: Props = $props();
</script>

<div class="generic-renderer">
    <JsonTree value={record.value} {pdsEndpoint} {did} />
</div>

<style>
    .generic-renderer {
        /* Inherits density from JsonTree */
    }
</style>
