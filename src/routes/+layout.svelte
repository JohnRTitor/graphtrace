<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import { comparePlaybackStates, playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { availableEditModes } from '$lib/state/editor-modes';
	import { environmentState } from '$lib/state/environment.svelte';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { onMount, onDestroy } from 'svelte';

	let { children } = $props();

	/**
	 * Panes that currently hold a trace. Driving "every pane that has something
	 * loaded" rather than a fixed pair is what lets the comparison view work with
	 * two panes or four without the shortcuts knowing which.
	 */
	function loadedPanes() {
		return [playbackState, ...comparePlaybackStates].filter((state) => state.hasLoadedTrace);
	}

	function pausePlayback() {
		for (const state of loadedPanes()) state.pause();
	}

	function playPlayback() {
		for (const state of loadedPanes()) state.play();
	}

	function stepPlayback() {
		pausePlayback();
		for (const state of loadedPanes()) {
			if (state.isCompleted) state.seek(0);
			state.step();
		}
	}

	function stepBackPlayback() {
		pausePlayback();
		for (const state of loadedPanes()) state.stepBack();
	}

	function resetPlayback() {
		for (const state of loadedPanes()) state.reset();
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
		// Cmd/Ctrl+K is the algorithm palette, and is bound on the document by the
		// page so it works from inside the canvas too. It is listed here so the
		// shortcuts dialog can read the same table.
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
			case 'b':
				e.preventDefault();
				stepBackPlayback();
				break;
			case 'r':
				e.preventDefault();
				resetPlayback();
				break;
			case 'e': {
				// Toggle between the two paint tools, and only when this environment
				// actually has them. Derived from the same table the toolbar renders,
				// so a new environment cannot leave a shortcut writing a tool its
				// canvas does not implement - which is how this rule drifted before.
				const paint = availableEditModes(environmentState.environmentType).filter(
					(mode) => mode === 'wall' || mode === 'erase'
				);
				if (paint.length < 2) return;
				e.preventDefault();
				editorState.mode = editorState.mode === paint[0] ? paint[1] : paint[0];
				break;
			}
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		playbackState.pause();
		for (const pane of comparePlaybackStates) pane.pause();
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
