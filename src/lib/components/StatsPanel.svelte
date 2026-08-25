<script lang="ts">
	import { playbackState } from '$lib/state/playback.svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
</script>

<Card>
	<CardHeader class="pb-3 flex flex-row items-center justify-between space-y-0">
		<CardTitle class="text-sm font-medium">Algorithm Statistics</CardTitle>
		{#if playbackState.isIdle}
			<Badge variant="secondary">Idle</Badge>
		{:else if playbackState.isRunning}
			<Badge variant="default" class="bg-blue-500 hover:bg-blue-600">Running</Badge>
		{:else if playbackState.isPaused}
			<Badge variant="outline">Paused</Badge>
		{:else}
			<Badge variant="default" class="bg-green-500 hover:bg-green-600">Completed</Badge>
		{/if}
	</CardHeader>
	<CardContent>
		<div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Nodes Discovered</span>
				<span class="font-mono font-medium">{playbackState.metrics?.nodesDiscovered ?? 0}</span>
			</div>
			
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Nodes Expanded</span>
				<span class="font-mono font-medium">{playbackState.metrics?.nodesExpanded ?? 0}</span>
			</div>
			
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Max Frontier</span>
				<span class="font-mono font-medium">{playbackState.metrics?.maxFrontierSize ?? 0}</span>
			</div>
			
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Path Length</span>
				<span class="font-mono font-medium">{playbackState.metrics?.pathLength ?? 0}</span>
			</div>
			
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Path Cost</span>
				<span class="font-mono font-medium">{playbackState.metrics?.pathCost ?? 0}</span>
			</div>
			
			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">Execution Time</span>
				<span class="font-mono font-medium">
					{playbackState.metrics ? playbackState.metrics.executionTimeMs.toFixed(2) : '0.00'} ms
				</span>
			</div>
		</div>
	</CardContent>
</Card>
