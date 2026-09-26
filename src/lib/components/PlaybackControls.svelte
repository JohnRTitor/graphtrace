<script lang="ts">
	import {
	playbackState,
	comparePlaybackStates,
	TIMELINE_STEP,
	type PlaybackState
} from '$lib/state/playback.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { buildTimeline, kindToTraceToken, kindsInOrder, TIMELINE_BUCKETS } from '$lib/trace/timeline';
	import { nextStepOfKind, previousStepOfKind, type TraceEvent } from '$lib/trace/types';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	/**
	 * The transport dock.
	 *
	 * A bare percentage slider gives no way to navigate a minimax trace, which can
	 * run to tens of thousands of events. This replaces it with a scrubber whose
	 * track is a density map of the trace - colour-coded by event kind - plus
	 * "jump to next/previous event of kind X" controls, so navigating a trace by
	 * what it *did* rather than by a percentage is the primary interaction.
	 */
	let speed = $state(playbackState.speed);

	let events = $derived(playbackState.traceEvents);
	let timeline = $derived(buildTimeline(events));
	/**
	 * The average events-per-bucket, hoisted out of the render loop. It used to be
	 * computed as `events.length / TIMELINE_BUCKETS` inside the loop body, so it
	 * was recomputed 120 times per render.
	 */
	let eventsPerBucket = $derived(events.length / TIMELINE_BUCKETS);
	let kinds = $derived(kindsInOrder(events));
	let hasTrace = $derived(playbackState.hasLoadedTrace && events.length > 0);

	/** The pane states that currently hold a trace, in pane order. */
	let panes = $derived.by(() => {
		const all = [playbackState, ...comparePlaybackStates];
		return all.filter((state) => state.hasLoadedTrace);
	});

	let progressValue = $derived(playbackState.progressPercentage);

	function allPanes(action: (state: PlaybackState) => void) {
		for (const state of panes) action(state);
	}

	function pauseAll() {
		allPanes((state) => state.pause());
	}

	function playAll() {
		allPanes((state) => state.play());
	}

	function togglePlayPause() {
		if (!hasTrace) {
			environmentState.runAlgorithm('autoplay');
			return;
		}
		if (playbackState.isRunning) pauseAll();
		else playAll();
	}

	function stepAll() {
		if (!hasTrace) {
			environmentState.runAlgorithm('step');
			return;
		}
		pauseAll();
		for (const state of panes) {
			if (state.isCompleted) state.seek(0);
			state.step();
		}
	}

	function stepBackAll() {
		pauseAll();
		for (const state of panes) state.stepBack();
	}

	function resetAll() {
		for (const state of panes) state.reset();
	}

	/**
	 * Whether the user is actually driving the timeline slider right now.
	 *
	 * A controlled slider reports programmatic changes through `onValueChange` -
	 * it is called from the value *setter* - so the playhead's own movement arrives
	 * here on every step of playback, indistinguishable by value alone. Comparing
	 * the emitted number against the current progress was tried and is not
	 * reliable: at 200+ events per second the playhead crosses several slider steps
	 * in a single frame, so any staleness at all exceeds the tolerance.
	 *
	 * So the emission is only trusted when there is a hand on the slider, or when
	 * nothing is playing for an echo to be interrupting.
	 */
	let scrubbing = $state(false);

	function scrub(value: number) {
		if (playbackState.isRunning && !scrubbing) return;
		pauseAll();
		for (const state of panes) state.seekPercentage(value);
	}

	/**
	 * Jumping to an event kind is the reason the timeline exists, so it drives
	 * *every* mounted pane: the whole point of the comparison view is watching
	 * two algorithms hit (or skip) the same kind of event at the same moment.
	 */
	function jump(kind: string, direction: 'next' | 'prev') {
		pauseAll();
		for (const state of panes) {
			const target =
				direction === 'next'
					? nextStepOfKind(state.traceEvents, kind, state.currentStep - 1)
					: previousStepOfKind(state.traceEvents, kind, state.currentStep);
			if (target >= 0) state.seek(target + 1);
		}
	}

	let currentKindLabel = $derived.by(() => {
		const kind = playbackState.currentKind;
		return kind ?? null;
	});

	$effect(() => {
		playbackState.setSpeed(speed);
		for (const state of comparePlaybackStates) state.setSpeed(speed);
	});
</script>

<div class="flex flex-col gap-3">
	{#if environmentState.runError}
		<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
			{environmentState.runError}
		</p>
	{/if}

	<div class="flex items-center justify-between">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Playback</h3>
		<div class="gt-mono flex items-center gap-2 text-[11px] text-muted-foreground">
			{#if currentKindLabel}
				<span class="rounded bg-muted px-1.5 py-0.5">at {currentKindLabel}</span>
			{/if}
			<span>{playbackState.currentStep} / {playbackState.totalSteps}</span>
			<span>({Math.round(progressValue)}%)</span>
		</div>
	</div>

	<!--
		The track is a density map of the trace: one column per bucket, each column
		showing the event kinds present in it. Height encodes count, so a burst of
		pruning is visible as a spike without reading a single tick.

		Critically, the buckets below read nothing that changes during playback. The
		previously-played portion is a single overlay element and the playhead is a
		single element, so advancing a step touches two DOM nodes rather than
		re-rendering all 120 columns. A minimax trace can be tens of thousands of
		events, and at 60fps that difference is the whole frame budget.
	-->
	<div class="relative">
		<div
			class="relative h-9 w-full overflow-hidden rounded-md border bg-muted/40"
			role="presentation"
			aria-hidden="true"
		>
			{#each timeline as bucket, index (bucket.start)}
				{@const height = Math.min(100, 30 + (bucket.count / eventsPerBucket) * 70)}
				<div
					class="absolute bottom-0 w-px opacity-70"
					style:left={`${(index / TIMELINE_BUCKETS) * 100}%`}
					style:height={`${height}%`}
				>
					{#each bucket.kinds as entry (entry.kind)}
						{@const token = kindToTraceToken(entry.kind)}
						<span
							class="block w-px"
							style:height={`${Math.max(12, (entry.count / bucket.count) * 100)}%`}
							style:background-color={token === 'neutral'
								? 'var(--muted-foreground)'
								: `var(--trace-${token})`}
						></span>
					{/each}
				</div>
			{/each}

			<!-- The un-played remainder, dimmed by one element rather than per bucket. -->
			<div
				class="pointer-events-none absolute inset-y-0 right-0 bg-background/55 gt-transition-state"
				style:left={`${progressValue}%`}
			></div>

			<!-- Playhead: a hard edge, so the current step is unambiguous. -->
			<div
				class="pointer-events-none absolute inset-y-0 w-px bg-foreground"
				style:left={`${progressValue}%`}
			></div>
		</div>

		<div class="absolute inset-x-0 top-0 px-1">
			<Slider
				aria-label="Trace position"
				type="single"
				value={progressValue}
				onValueChange={(value) => scrub(value)}
				onpointerdown={() => (scrubbing = true)}
				onpointerup={() => (scrubbing = false)}
				onpointercancel={() => (scrubbing = false)}
				onlostpointercapture={() => (scrubbing = false)}
				onkeydown={() => (scrubbing = true)}
				onkeyup={() => (scrubbing = false)}
				min={0}
				max={100}
				step={TIMELINE_STEP}
				class="w-full"
			/>
		</div>
	</div>

	<!--
		Event-kind navigation. Each kind present in the trace gets a jump control
		labelled with its own reserved colour, so the same affordance works for
		`discover` in a grid and `prune` in a game tree.
	-->
	{#if kinds.length > 0}
		<div class="flex flex-wrap items-center gap-1">
			<span class="text-[10px] uppercase tracking-wide text-muted-foreground">jump</span>
			{#each kinds as kind (kind)}
				{@const token = kindToTraceToken(kind)}
				<div class="flex items-center overflow-hidden rounded border">
					<button
						type="button"
						class="px-1 py-0.5 text-[10px] gt-transition-feedback hover:bg-accent"
						onclick={() => jump(kind, 'prev')}
						title={`Previous ${kind} event`}
						aria-label={`Jump to previous ${kind} event`}
					>
						<ChevronLeft class="h-3 w-3" />
					</button>
					<button
						type="button"
						class="flex items-center gap-1 border-x px-1.5 py-0.5 text-[10px] font-medium gt-transition-feedback hover:bg-accent"
						onclick={() => jump(kind, 'next')}
						title={`Next ${kind} event`}
					>
						<span
							class="gt-trace-swatch !h-2 !w-2"
							style:background-color={token === 'neutral'
								? 'var(--muted-foreground)'
								: `var(--trace-${token})`}
						></span>
						{kind}
					</button>
					<button
						type="button"
						class="px-1 py-0.5 text-[10px] gt-transition-feedback hover:bg-accent"
						onclick={() => jump(kind, 'next')}
						title={`Next ${kind} event`}
						aria-label={`Jump to next ${kind} event`}
					>
						<ChevronRight class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex items-center justify-center gap-2">
		<Button
			variant="outline"
			size="icon"
			onclick={resetAll}
			disabled={!hasTrace}
			title="Reset (R)"
		>
			<RotateCcw class="h-4 w-4" />
			<span class="sr-only">Reset</span>
		</Button>
		<Button
			variant="outline"
			size="icon"
			onclick={stepBackAll}
			disabled={!hasTrace || playbackState.currentStep === 0}
			title="Step Back (B)"
		>
			<SkipBack class="h-4 w-4" />
			<span class="sr-only">Step Back</span>
		</Button>
		<Button variant="default" size="icon" class="h-10 w-10" onclick={togglePlayPause} title="Play/Pause (Space)">
			{#if playbackState.isRunning}
				<Pause class="h-5 w-5" />
			{:else}
				<Play class="ml-1 h-5 w-5" />
			{/if}
			<span class="sr-only">Play/Pause</span>
		</Button>
		<Button
			variant="outline"
			size="icon"
			onclick={stepAll}
			disabled={playbackState.isRunning}
			title="Step Forward (N)"
		>
			<SkipForward class="h-4 w-4" />
			<span class="sr-only">Step Forward</span>
		</Button>
	</div>

	<div class="space-y-1.5">
		<div class="flex items-center justify-between">
			<label for="speed-slider" class="text-[11px] text-muted-foreground">Speed</label>
			<span class="gt-mono text-[11px] tabular-nums text-muted-foreground">{speed} ev/s</span>
		</div>
		<Slider id="speed-slider" type="single" bind:value={speed} min={1} max={2000} step={1} class="w-full" />
	</div>
</div>
