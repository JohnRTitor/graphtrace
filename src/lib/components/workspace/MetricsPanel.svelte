<script lang="ts">
	import type { AnyExecution } from '$lib/domain/execution';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import { getFamily } from '$lib/families/registry';
	import type { MetricColumn } from '$lib/trace/types';
	import { Badge } from '$lib/components/ui/badge';
	import { playbackState } from '$lib/state/playback.svelte';

	interface Props {
		executions: AnyExecution[];
	}

	let { executions }: Props = $props();

	/**
	 * Metric columns come from the family of the executions on show, not from a
	 * hard-coded list. With a single family active that is the same six rows the
	 * app always had; when two families are compared side by side, the columns
	 * are the union, and a metric only one family produces reads as absent rather
	 * than as zero.
	 */
	let columns = $derived.by(() => {
		const seen = new Map<string, MetricColumn>();
		for (const execution of executions) {
			const family = getFamily(execution.familyId);
			for (const column of family?.metricsColumns ?? []) {
				seen.set(column.key, column);
			}
		}
		return Array.from(seen.values());
	});

	function read(execution: AnyExecution, column: MetricColumn): string | null {
		const value = execution.metrics[column.key];
		if (typeof value !== 'number' || !Number.isFinite(value)) return null;
		return column.format ? column.format(value) : String(value);
	}

	/**
	 * Highlights the best value in a row when every execution that reports the
	 * metric agrees on which direction is better. Ties and single-entry rows are
	 * left unmarked: a "winner" that is only marginally better is noise.
	 */
	let winners = $derived.by(() => {
		const result = new Map<string, number>();
		for (const column of columns) {
			if (!column.better || executions.length < 2) continue;
			const values = executions
				.map((execution) => execution.metrics[column.key])
				.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
			if (values.length !== executions.length || values.length < 2) continue;
			const best = column.better === 'lower' ? Math.min(...values) : Math.max(...values);
			if (values.filter((value) => value === best).length !== 1) continue;
			result.set(column.key, best);
		}
		return result;
	});

	let status = $derived.by(() => {
		if (executions.length === 0) return null;
		if (playbackState.isRunning) return { label: 'Running', variant: 'default' as const };
		if (playbackState.isPaused) return { label: 'Paused', variant: 'outline' as const };
		if (playbackState.isCompleted) return { label: 'Completed', variant: 'secondary' as const };
		return { label: 'Idle', variant: 'secondary' as const };
	});
</script>

<div class="space-y-4 p-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold tracking-tight">Metrics</h2>
		{#if status}
			<Badge variant={status.variant} class="text-[10px]">{status.label}</Badge>
		{/if}
	</div>

	{#if executions.length === 0}
		<p class="py-6 text-center text-sm text-muted-foreground">
			Run an algorithm to collect metrics.
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full min-w-[360px] border-separate border-spacing-y-1 text-left text-xs">
				<caption class="sr-only">Algorithm execution metrics</caption>
				<thead>
					<tr>
						<th scope="col" class="font-medium text-muted-foreground">Metric</th>
						{#each executions as execution (execution.id)}
							<th scope="col" class="text-right font-medium">
								{getAlgorithmSummary(execution.algorithmId)?.name ?? execution.algorithmId}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each columns as column (column.key)}
						<tr>
							<th scope="row" class="font-normal text-muted-foreground" title={column.description}>
								{column.label}
							</th>
							{#each executions as execution (execution.id)}
								{@const text = read(execution, column)}
								{@const raw = execution.metrics[column.key]}
								<td
									class="gt-mono text-right tabular-nums gt-transition-state"
									class:font-semibold={text !== null && winners.get(column.key) === raw}
									class:text-primary={text !== null && winners.get(column.key) === raw}
									class:text-muted-foreground={text === null}
								>
									{text ?? '—'}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if executions.length > 1}
			<p class="text-xs text-muted-foreground">
				The highlighted value is the better one for that row.
			</p>
		{/if}
	{/if}
</div>
