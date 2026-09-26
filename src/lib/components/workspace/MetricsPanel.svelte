<script lang="ts">
	import type { AnyExecution } from '$lib/domain/execution';
	import { getAlgorithmSummary } from '$lib/algorithms';
	import { getFamily } from '$lib/families/registry';
	import type { MetricColumn } from '$lib/trace/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '$lib/components/ui/empty';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
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

<div class="space-y-4 p-3 sm:p-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold tracking-tight">Metrics</h2>
		{#if status}
			<Badge variant={status.variant} class="text-[10px]">{status.label}</Badge>
		{/if}
	</div>

	{#if executions.length === 0}
		<Empty class="py-6">
			<EmptyHeader>
				<EmptyTitle class="text-xs font-medium text-foreground">No metrics yet</EmptyTitle>
				<EmptyDescription class="text-xs">
					Run an algorithm to collect metrics.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	{:else}
		<!--
			No min width. The panel is a 288px column, and a 360px table inside it
			meant 50px of permanent horizontal scroll on a phone. Algorithm names
			wrap instead, which is the trade that keeps the whole table visible.
		-->
		<Table class="text-xs">
			<TableHeader>
				<TableRow class="hover:bg-transparent">
					<TableHead class="font-medium text-muted-foreground">Metric</TableHead>
					{#each executions as execution (execution.id)}
						<TableHead class="text-right font-medium break-words">
							{getAlgorithmSummary(execution.algorithmId)?.name ?? execution.algorithmId}
						</TableHead>
					{/each}
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each columns as column (column.key)}
					<TableRow>
						<TableHead
							scope="row"
							class="font-normal text-muted-foreground"
							title={column.description}
						>
							{column.label}
						</TableHead>
						{#each executions as execution (execution.id)}
							{@const text = read(execution, column)}
							{@const raw = execution.metrics[column.key]}
							{@const isWinner = text !== null && winners.get(column.key) === raw}
							<TableCell
								class="gt-mono text-right tabular-nums gt-transition-state {isWinner
									? 'font-semibold text-primary'
									: ''} {text === null ? 'text-muted-foreground' : ''}"
							>
								{text ?? '—'}
							</TableCell>
						{/each}
					</TableRow>
				{/each}
			</TableBody>
		</Table>
		{#if executions.length > 1}
			<p class="text-xs text-muted-foreground">
				The highlighted value is the better one for that row.
			</p>
		{/if}
	{/if}
</div>
