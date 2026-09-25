<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';

	let { open = $bindable(false) } = $props<{ open: boolean }>();
</script>

{#snippet shortcutItem(label: string, key: string)}
	<div class="grid grid-cols-[1fr_auto] items-center gap-4">
		<span class="text-sm">{label}</span>
		<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
			{key}
		</kbd>
	</div>
{/snippet}

<Dialog bind:open>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Keyboard Shortcuts</DialogTitle>
			<DialogDescription>
				Control the visualization and playback with your keyboard.
			</DialogDescription>
		</DialogHeader>

		<div class="grid gap-6 py-4">
			<section class="grid gap-3">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Playback</h3>
				{@render shortcutItem('Play / Pause', 'Space')}
				{@render shortcutItem('Step Forward', 'N')}
				{@render shortcutItem('Step Back', 'B')}
				{@render shortcutItem('Reset', 'R')}
			</section>

			<section class="grid gap-3">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selecting</h3>
				{@render shortcutItem('Algorithm palette', '⌘K / Ctrl K')}
				{@render shortcutItem('Toggle Wall / Erase (grids only)', 'E')}
				{@render shortcutItem('Cancel / Close', 'Esc')}
			</section>
		</div>

		<p class="text-xs text-muted-foreground">
			In the palette, use the arrow keys to move and Enter to choose. Shortcuts are
			ignored while a text field, menu or dialog has focus.
		</p>
	</DialogContent>
</Dialog>
