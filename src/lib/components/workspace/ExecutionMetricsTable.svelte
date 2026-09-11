<script lang="ts">
	import type { Execution } from '$lib/domain/execution';
	import { Label } from '$lib/components/ui/label';

	let { executions = [] }: { executions?: Execution[] } = $props();
</script>

{#if executions.length > 0}
	<div class="space-y-3 pt-2">
		<h3 class="text-xs font-medium">Execution Metrics</h3>
		<div class="grid" style="grid-template-columns: auto {executions.map(() => '1fr').join(' ')}; gap: 0.5rem;">
			<!-- Header Row -->
			<div class="text-xs text-muted-foreground font-semibold">Metric</div>
			{#each executions as exec}
				<div class="text-xs font-semibold truncate text-right">{exec.algorithmId}</div>
			{/each}

			<Label class="text-xs text-muted-foreground">Nodes Discovered</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.nodesDiscovered}</div>
			{/each}

			<Label class="text-xs text-muted-foreground">Nodes Expanded</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.nodesExpanded}</div>
			{/each}

			<Label class="text-xs text-muted-foreground">Max Frontier Size</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.maxFrontierSize}</div>
			{/each}
			
			<Label class="text-xs text-muted-foreground">Path Length</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.pathLength}</div>
			{/each}
			
			<Label class="text-xs text-muted-foreground">Path Cost</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.pathCost}</div>
			{/each}

			<Label class="text-xs text-muted-foreground">Execution Time</Label>
			{#each executions as exec}
				<div class="text-xs text-right">{exec.metrics.executionTimeMs.toFixed(2)} ms</div>
			{/each}
		</div>
	</div>
{/if}
