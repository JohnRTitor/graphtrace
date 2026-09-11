<script lang="ts">
	import CanvasView from '../CanvasView.svelte';
	import { playbackState, comparePlaybackState } from '$lib/state/playback.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import ExecutionMetricsTable from '$lib/components/workspace/ExecutionMetricsTable.svelte';
</script>

<div class="flex h-full w-full">
	<!-- Left Pane: Active Execution -->
	<div class="flex-1 border-r relative flex flex-col h-full overflow-hidden">
		<div class="absolute top-2 left-2 z-10">
			<Card class="bg-background/80 backdrop-blur-sm shadow-sm pointer-events-none">
				<CardHeader class="p-3 pb-0">
					<CardTitle class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
						Execution 1
					</CardTitle>
				</CardHeader>
				<CardContent class="p-3 pt-1">
					<span class="font-medium">{executionStore.activeExecution?.algorithmId || 'None'}</span>
				</CardContent>
			</Card>
		</div>
		<CanvasView playback={playbackState} />
	</div>
	
	<!-- Right Pane: Compared Execution -->
	<div class="flex-1 relative flex flex-col h-full overflow-hidden">
		<div class="absolute top-2 left-2 z-10">
			<Card class="bg-background/80 backdrop-blur-sm shadow-sm pointer-events-none">
				<CardHeader class="p-3 pb-0">
					<CardTitle class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
						Execution 2
					</CardTitle>
				</CardHeader>
				<CardContent class="p-3 pt-1">
					<span class="font-medium">{executionStore.compareExecution?.algorithmId || 'None'}</span>
				</CardContent>
			</Card>
		</div>
		<CanvasView playback={comparePlaybackState} />
	</div>
	
	<!-- Bottom Center: Comparison Metrics Table -->
	<div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
		<Card class="bg-background/95 backdrop-blur shadow-lg min-w-[500px]">
			<CardHeader class="p-4 pb-2">
				<CardTitle class="text-sm font-semibold text-center">Comparison Metrics</CardTitle>
			</CardHeader>
			<CardContent class="p-4 pt-0">
				<ExecutionMetricsTable 
					executions={[executionStore.activeExecution, executionStore.compareExecution].filter(Boolean) as any} 
				/>
			</CardContent>
		</Card>
	</div>
</div>
