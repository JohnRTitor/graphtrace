<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Kbd } from '$lib/components/ui/kbd';

	let { open = $bindable(false) } = $props<{ open: boolean }>();
</script>

{#snippet shortcutItem(label: string, key: string)}
	<div class="grid grid-cols-[1fr_auto] items-center gap-3 sm:gap-4">
		<span class="text-sm">{label}</span>
		<Kbd class="shrink-0 whitespace-nowrap">{key}</Kbd>
	</div>
{/snippet}

<Dialog bind:open>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>Keyboard shortcuts</DialogTitle>
			<DialogDescription>
				Control the visualization and playback with your keyboard.
			</DialogDescription>
		</DialogHeader>

		<div class="grid gap-5 py-3 sm:gap-6">
			<section class="grid gap-2.5">
				<h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Playback
				</h3>
				{@render shortcutItem('Play / Pause', 'Space')}
				{@render shortcutItem('Step Forward', 'N')}
				{@render shortcutItem('Step Back', 'B')}
				{@render shortcutItem('Reset', 'R')}
			</section>

			<section class="grid gap-2.5">
				<h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Selecting
				</h3>
				{@render shortcutItem('Algorithm palette', '⌘K / Ctrl K')}
				{@render shortcutItem('Toggle Wall / Erase (grids only)', 'E')}
				{@render shortcutItem('Cancel / Close', 'Esc')}
			</section>

			<section class="grid gap-2.5">
				<h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Layout
				</h3>
				{@render shortcutItem('Show / hide the problem builder', '⌘B / Ctrl B')}
				{@render shortcutItem('Show / hide the details panel', 'Click the panel button')}
			</section>
		</div>

		<p class="text-xs text-muted-foreground">
			In the palette, use the arrow keys to move and Enter to choose. Shortcuts are
			ignored while a text field, menu or dialog has focus.
		</p>
	</DialogContent>
</Dialog>
