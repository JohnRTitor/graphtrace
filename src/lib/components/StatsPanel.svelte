<script lang="ts">
	import { playbackState, comparePlaybackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import FloatingPanel from '$lib/components/FloatingPanel.svelte';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button';

	let floatingPanel = $state<ReturnType<typeof FloatingPanel>>();
</script>

{#snippet statRow(label: string, value: string | number, value2?: string | number)}
	<div class="flex flex-col border border-border/50 rounded-md p-4 bg-muted/10">
		<span class="text-xs text-muted-foreground">{label}</span>
		{#if executionStore.isComparing && value2 !== undefined}
			<div class="grid grid-cols-2 gap-2 mt-1">
				<div class="flex flex-col">
					<span class="text-[10px] text-muted-foreground uppercase">Exec 1</span>
					<span class="font-mono font-medium">{value}</span>
				</div>
				<div class="flex flex-col">
					<span class="text-[10px] text-muted-foreground uppercase">Exec 2</span>
					<span class="font-mono font-medium">{value2}</span>
				</div>
			</div>
		{:else}
			<span class="font-mono font-medium mt-1">{value}</span>
		{/if}
	</div>
{/snippet}

<FloatingPanel id="statistics" bind:this={floatingPanel}>
	{#snippet header()}
		<CardHeader class="p-5 pb-4 flex flex-row items-center justify-between space-y-0 relative">
			<CardTitle class="text-base font-medium">Algorithm Statistics</CardTitle>
			<div class="flex items-center gap-2">
				{#if playbackState.isIdle}
					<Badge variant="secondary">Idle</Badge>
				{:else if playbackState.isRunning || (executionStore.isComparing && comparePlaybackState.isRunning)}
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
		<div class="grid grid-cols-2 gap-3 text-sm">
			{@render statRow('Nodes Discovered', playbackState.metrics?.nodesDiscovered ?? 0, comparePlaybackState.metrics?.nodesDiscovered ?? 0)}
			{@render statRow('Nodes Expanded', playbackState.metrics?.nodesExpanded ?? 0, comparePlaybackState.metrics?.nodesExpanded ?? 0)}
			{@render statRow('Max Frontier', playbackState.metrics?.maxFrontierSize ?? 0, comparePlaybackState.metrics?.maxFrontierSize ?? 0)}
			{@render statRow('Path Length', playbackState.metrics?.pathLength ?? 0, comparePlaybackState.metrics?.pathLength ?? 0)}
			{@render statRow('Path Cost', playbackState.metrics?.pathCost ?? 0, comparePlaybackState.metrics?.pathCost ?? 0)}
			{@render statRow('Execution Time', `${playbackState.metrics ? playbackState.metrics.executionTimeMs.toFixed(2) : '0.00'} ms`, `${comparePlaybackState.metrics ? comparePlaybackState.metrics.executionTimeMs.toFixed(2) : '0.00'} ms`)}
		</div>
	</CardContent>
</FloatingPanel>
