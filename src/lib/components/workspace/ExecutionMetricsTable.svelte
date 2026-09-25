<script lang="ts">
	import type { Execution } from '$lib/domain/execution';
	import { getAlgorithm } from '$lib/algorithms';

	let { executions = [] }: { executions?: Execution[] } = $props();

	const metricRows = [
		{ label: 'Nodes Discovered', value: (execution: Execution) => execution.metrics.nodesDiscovered },
		{ label: 'Nodes Expanded', value: (execution: Execution) => execution.metrics.nodesExpanded },
		{ label: 'Max Frontier Size', value: (execution: Execution) => execution.metrics.maxFrontierSize },
		{ label: 'Path Length', value: (execution: Execution) => execution.metrics.pathLength },
		{ label: 'Path Cost', value: (execution: Execution) => execution.metrics.pathCost },
		{ label: 'Execution Time', value: (execution: Execution) => `${execution.metrics.executionTimeMs.toFixed(2)} ms` }
	];

	function algorithmName(id: string): string {
		return getAlgorithm(id)?.name ?? id;
	}
</script>

{#if executions.length > 0}
	<div class="space-y-3 pt-2">
		<h3 class="text-xs font-medium">Execution Metrics</h3>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[420px] border-separate border-spacing-2 text-left text-xs">
				<caption class="sr-only">Algorithm execution metrics</caption>
				<thead>
					<tr>
						<th scope="col" class="font-semibold text-muted-foreground">Metric</th>
						{#each executions as execution}
							<th scope="col" class="text-right font-semibold">{algorithmName(execution.algorithmId)}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each metricRows as metric}
						<tr>
							<th scope="row" class="font-normal text-muted-foreground">{metric.label}</th>
							{#each executions as execution}
								<td class="text-right tabular-nums">{metric.value(execution)}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
