<script lang="ts">
	import { playbackState } from '$lib/state/playback.svelte';
	import { settingsState } from '$lib/state/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

	function handlePlayPause() {
		if (playbackState.isIdle || playbackState.isCompleted) {
			settingsState.runAlgorithm();
		} else {
			playbackState.togglePlayPause();
		}
	}

	function handleStep() {
		if (playbackState.isIdle || playbackState.isCompleted) {
			settingsState.runAlgorithm();
			playbackState.pause();
		}
		playbackState.step();
	}

	function handleReset() {
		playbackState.reset();
	}
	
	let sliderValue = $state(playbackState.speed);
	
	$effect(() => {
		playbackState.setSpeed(sliderValue);
	});
	
	// Keep slider in sync if speed changes externally
	$effect(() => {
		sliderValue = playbackState.speed;
	});
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium">Playback</h3>
		<span class="text-xs text-muted-foreground">{Math.round(playbackState.progressPercentage)}%</span>
	</div>
	
	<div class="flex items-center justify-center gap-2">
		<Button 
			variant="outline" 
			size="icon" 
			onclick={handleReset}
			disabled={playbackState.isIdle}
			title="Reset (R)"
		>
			<RotateCcw class="h-4 w-4" />
			<span class="sr-only">Reset</span>
		</Button>
		
		<Button 
			variant="default" 
			size="icon" 
			class="h-10 w-10"
			onclick={handlePlayPause}
			title="Play/Pause (Space)"
		>
			{#if playbackState.isRunning}
				<Pause class="h-5 w-5" />
			{:else}
				<Play class="h-5 w-5 ml-1" /> <!-- slight offset for optical centering -->
			{/if}
			<span class="sr-only">Play/Pause</span>
		</Button>
		
		<Button 
			variant="outline" 
			size="icon" 
			onclick={handleStep}
			disabled={playbackState.isRunning || playbackState.isCompleted}
			title="Step Forward (N)"
		>
			<SkipForward class="h-4 w-4" />
			<span class="sr-only">Step Forward</span>
		</Button>
	</div>

	<div class="space-y-3 pt-2">
		<div class="flex items-center justify-between">
			<label for="speed-slider" class="text-xs text-muted-foreground">Speed</label>
			<span class="text-xs tabular-nums text-muted-foreground">{playbackState.speed} ops/s</span>
		</div>
		<Slider
			id="speed-slider"
			type="single"
			bind:value={sliderValue}
			max={2000}
			min={1}
			step={1}
			class="w-full"
		/>
	</div>
</div>
