<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import { playbackState } from '$lib/state/playback.svelte';
	import { editorState } from '$lib/state/editor.svelte';
	import { settingsState } from '$lib/state/settings.svelte';
	import { onMount, onDestroy } from 'svelte';
	
	let { children } = $props();

	function handleKeydown(e: KeyboardEvent) {
		// Ignore if typing in input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

		switch (e.key.toLowerCase()) {
			case ' ':
				e.preventDefault();
				if (playbackState.isIdle || playbackState.isCompleted) {
					settingsState.runAlgorithm();
				} else {
					playbackState.togglePlayPause();
				}
				break;
			case 'n':
				e.preventDefault();
				if (playbackState.isIdle || playbackState.isCompleted) {
					settingsState.runAlgorithm();
					playbackState.pause();
				}
				playbackState.step();
				break;
			case 'r':
				e.preventDefault();
				playbackState.reset();
				break;
			case 'e':
				e.preventDefault();
				editorState.mode = editorState.mode === 'wall' ? 'erase' : 'wall';
				break;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<ModeWatcher />
{@render children()}
