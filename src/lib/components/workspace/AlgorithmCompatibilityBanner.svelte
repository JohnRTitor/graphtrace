<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { checkCompatibility } from '$lib/domain/compatibility';
	import type { Problem } from '$lib/domain/problem';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	let warnings = $derived.by(() => {
		if (!environmentState.currentAlgorithm) return [];

		const problem: Problem = environmentState.getProblem();

		return checkCompatibility(problem, environmentState.selectedAlgorithmId);
	});
</script>

<!--
	A compatibility note, not a notification.

	It sits directly above the canvas and describes the problem that is about to be
	visualised, so it is part of the canvas's own chrome rather than something that
	arrives and leaves. It is capped and scrollable because it competes with the
	graph for vertical space, and a warning that pushes the graph off screen is
	worse than one you have to scroll.
-->
{#if warnings.length > 0}
	<div class="max-h-24 shrink-0 overflow-y-auto">
		<div class="flex flex-col gap-1.5 p-2 pb-0">
			{#each warnings as warning}
				<Alert role="status" class="rounded-lg border-amber-500/25 bg-amber-500/10 py-2 text-amber-700 dark:text-amber-300">
					<AlertTriangle />
					<AlertTitle class="text-xs">Algorithm warning</AlertTitle>
					<AlertDescription class="text-xs">{warning.message}</AlertDescription>
				</Alert>
			{/each}
		</div>
	</div>
{/if}
