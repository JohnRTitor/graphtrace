<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { comparePlaybackState, playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { onMount, onDestroy } from 'svelte';
	
	let { children } = $props();

	function pausePlayback() {
		playbackState.pause();
		if (executionStore.isComparing) comparePlaybackState.pause();
	}

	function playPlayback() {
		playbackState.play();
		if (executionStore.isComparing) comparePlaybackState.play();
	}

	function stepPlayback() {
		pausePlayback();
		if (playbackState.isCompleted) playbackState.seek(0);
		playbackState.step();
		if (executionStore.isComparing) {
			if (comparePlaybackState.isCompleted) comparePlaybackState.seek(0);
			comparePlaybackState.step();
		}
	}

	function isInteractiveTarget(target: EventTarget | null): boolean {
		return target instanceof HTMLElement && target.closest(
			'input, textarea, select, button, a[href], [role="button"], [role="radio"], [role="switch"], [role="slider"], [role="grid"], [role="menuitem"], [contenteditable="true"]'
		) !== null;
	}

	function hasOpenOverlay(): boolean {
		return document.querySelector('[data-state="open"]') !== null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey || isInteractiveTarget(e.target) || hasOpenOverlay()) return;

		switch (e.key.toLowerCase()) {
			case ' ':
				e.preventDefault();
				if (!playbackState.hasLoadedTrace) {
					environmentState.runAlgorithm('autoplay');
				} else if (playbackState.isRunning) {
					pausePlayback();
				} else {
					playPlayback();
				}
				break;
			case 'n':
				e.preventDefault();
				if (!playbackState.hasLoadedTrace) {
					environmentState.runAlgorithm('step');
				} else {
					stepPlayback();
				}
				break;
			case 'r':
				e.preventDefault();
				playbackState.reset();
				if (executionStore.isComparing) comparePlaybackState.reset();
				break;
			case 'e':
				if (environmentState.environmentType === 'graph') return;
				e.preventDefault();
				editorState.mode = editorState.mode === 'wall' ? 'erase' : 'wall';
				break;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		playbackState.pause();
		comparePlaybackState.pause();
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
{@render children()}
