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

<Dialog bind:open>
	<DialogContent class="sm:max-w-[106.25rem]">
		<DialogHeader>
			<DialogTitle>Keyboard Shortcuts</DialogTitle>
			<DialogDescription>
				Control the visualization and playback with your keyboard.
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-[1fr_auto] items-center gap-4">
				<span class="text-sm">Play / Pause</span>
				<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
					Space
				</kbd>
			</div>
			<div class="grid grid-cols-[1fr_auto] items-center gap-4">
				<span class="text-sm">Step Forward</span>
				<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
					N
				</kbd>
			</div>
			<div class="grid grid-cols-[1fr_auto] items-center gap-4">
				<span class="text-sm">Reset</span>
				<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
					R
				</kbd>
			</div>
			<div class="grid grid-cols-[1fr_auto] items-center gap-4">
				<span class="text-sm">Toggle Edit Mode (Wall/Erase)</span>
				<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
					E
				</kbd>
			</div>
			<div class="grid grid-cols-[1fr_auto] items-center gap-4">
				<span class="text-sm">Cancel / Close</span>
				<kbd class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
					Esc
				</kbd>
			</div>
		</div>
	</DialogContent>
</Dialog>
