<script lang="ts">
	import { playbackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button';
	import ExecutionMetricsTable from '$lib/components/workspace/ExecutionMetricsTable.svelte';

	let floatingPanel = $state<ReturnType<typeof FloatingPanel>>();
	let singleExecutionArray = $derived(
		executionStore.activeExecution ? [executionStore.activeExecution] : []
	);
</script>

{#if !executionStore.isComparing}

<FloatingPanel id="statistics" bind:this={floatingPanel}>
	{#snippet header()}
		<CardHeader class="p-5 pb-4 flex flex-row items-center justify-between space-y-0 relative">
			<CardTitle class="text-base font-medium">Algorithm Statistics</CardTitle>
			<div class="flex items-center gap-2" role="status" aria-live="polite">
				{#if playbackState.isIdle}
					<Badge variant="secondary">Idle</Badge>
				{:else if playbackState.isRunning}
					<Badge variant="default" class="bg-blue-500 hover:bg-blue-600">Running</Badge>
				{:else if playbackState.isPaused}
					<Badge variant="outline">Paused</Badge>
				{:else}
					<Badge variant="default" class="bg-green-500 hover:bg-green-600">Completed</Badge>
				{/if}
				<Button 
					variant="ghost" 
					size="icon" 
					class="h-6 w-6 pointer-events-auto hover:bg-muted/50 text-muted-foreground"
					onmousedown={(e) => e.stopPropagation()}
					onpointerdown={(e) => e.stopPropagation()}
					onclick={() => floatingPanel?.resetPosition()}
					title="Reset Position"
				>
					<RotateCcw class="h-3 w-3" />
					<span class="sr-only">Reset Position</span>
				</Button>
			</div>
		</CardHeader>
	{/snippet}

	<CardContent class="p-5 pt-0">
		<ExecutionMetricsTable executions={singleExecutionArray} />
	</CardContent>
</FloatingPanel>
{/if}
