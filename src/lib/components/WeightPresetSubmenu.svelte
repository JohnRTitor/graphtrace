<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import { editorState } from '$lib/state/editor.svelte';
	import Weight from '@lucide/svelte/icons/weight';

	// Discrete presets rather than a free-form number input: the app has no
	// existing custom-weight dialog to integrate with (see remaining
	// issues), and the weight scale used throughout the UI (control panel
	// slider) is bounded 1-20, so a small, meaningful set of presets covers
	// the same range without inventing new weight semantics.
	const PRESETS = [2, 3, 5, 10, 20];

	let {
		label = 'Set Weight',
		currentWeight,
		onSelect,
		onCustom
	}: {
		label?: string;
		currentWeight: number | undefined;
		onSelect: (weight: number) => void;
		onCustom?: () => void;
	} = $props();
</script>

<ContextMenu.Sub>
	<ContextMenu.SubTrigger>
		<Weight />
		{label}
	</ContextMenu.SubTrigger>
	<ContextMenu.SubContent>
		{#each PRESETS as preset (preset)}
			<ContextMenu.Item onSelect={() => onSelect(preset)} disabled={currentWeight === preset}>
				{preset}
			</ContextMenu.Item>
		{/each}
		<ContextMenu.Separator />
		<ContextMenu.Item
			onSelect={() => onSelect(editorState.weightValue)}
			disabled={currentWeight === editorState.weightValue}
		>
			Panel value ({editorState.weightValue})
		</ContextMenu.Item>
		{#if onCustom}
			<ContextMenu.Separator />
			<ContextMenu.Item onSelect={onCustom}>
				Custom...
			</ContextMenu.Item>
		{/if}
	</ContextMenu.SubContent>
</ContextMenu.Sub>
