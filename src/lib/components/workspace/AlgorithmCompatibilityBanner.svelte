<script lang="ts">
  import { environmentState } from "$lib/state/environment.svelte";
  import { checkCompatibility } from "$lib/domain/compatibility";
  import type { Problem } from "$lib/domain/problem";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";

  let warnings = $derived.by(() => {
    if (!environmentState.currentAlgorithm) return [];

    const problem: Problem = environmentState.getProblem();

    return checkCompatibility(problem, environmentState.selectedAlgorithmId);
  });
</script>

{#if warnings.length > 0}
  <div class="flex flex-col gap-2">
    {#each warnings as warning}
      <div
        class="flex items-start gap-3 rounded-md bg-amber-500/15 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400"
      >
        <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span class="font-medium">Algorithm Warning:</span>
          {warning.message}
        </div>
      </div>
    {/each}
  </div>
{/if}
