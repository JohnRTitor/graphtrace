<script lang="ts">
	import CanvasView from '../CanvasView.svelte';
	import { playbackState, comparePlaybackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import ExecutionMetricsTable from '$lib/components/workspace/ExecutionMetricsTable.svelte';
	import type { Execution } from '$lib/domain/execution';

	let comparisonExecutions = $derived(
		[executionStore.activeExecution, executionStore.compareExecution].filter(
			(execution): execution is Execution => execution !== null
		)
	);
</script>

<div class="flex h-full w-full flex-col">
	<div class="flex min-h-0 flex-1">
		<div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border-r">
			<div class="absolute left-2 top-2 z-10">
				<Card class="pointer-events-none bg-background/80 shadow-sm backdrop-blur-sm">
					<CardHeader class="p-3 pb-0">
						<CardTitle class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution 1</CardTitle>
					</CardHeader>
					<CardContent class="p-3 pt-1">
						<span class="font-medium">{executionStore.activeExecution?.algorithmId || 'None'}</span>
					</CardContent>
				</Card>
			</div>
			<CanvasView playback={playbackState} />
		</div>

		<div class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
			<div class="absolute left-2 top-2 z-10">
				<Card class="pointer-events-none bg-background/80 shadow-sm backdrop-blur-sm">
					<CardHeader class="p-3 pb-0">
						<CardTitle class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution 2</CardTitle>
					</CardHeader>
					<CardContent class="p-3 pt-1">
						<span class="font-medium">{executionStore.compareExecution?.algorithmId || 'None'}</span>
					</CardContent>
				</Card>
			</div>
			<CanvasView playback={comparePlaybackState} />
		</div>
	</div>

	<div class="max-h-44 shrink-0 overflow-auto border-t bg-background/95 p-2">
		<Card class="bg-background/95 shadow-lg">
			<CardHeader class="p-4 pb-2">
				<CardTitle class="text-center text-sm font-semibold">Comparison Metrics</CardTitle>
			</CardHeader>
			<CardContent class="p-4 pt-0">
				<ExecutionMetricsTable executions={comparisonExecutions} />
			</CardContent>
		</Card>
	</div>
</div>
