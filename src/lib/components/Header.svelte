<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import FamilySwitcher from './workspace/FamilySwitcher.svelte';
	import { Button } from '$lib/components/ui/button';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import PanelRight from '@lucide/svelte/icons/panel-right';
	import Command from '@lucide/svelte/icons/command';

	let {
		onOpenShortcuts,
		onOpenPalette,
		onToggleBuilder,
		onToggleInspector
	} = $props<{
		onOpenShortcuts: () => void;
		onOpenPalette: () => void;
		onToggleBuilder?: () => void;
		onToggleInspector?: () => void;
	}>();
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
	<div class="flex h-14 w-full max-w-full items-center gap-3 px-3 sm:px-4">
		<div class="flex items-center">
			<a href="/" class="flex items-center gap-2">
				<span class="text-sm font-semibold tracking-tight">GraphTrace</span>
			</a>
		</div>

		<FamilySwitcher />

		<div class="flex flex-1 justify-end">
			<nav class="flex items-center gap-2">
				<button
					type="button"
					class="hidden h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-xs text-muted-foreground gt-transition-feedback hover:bg-accent hover:text-accent-foreground md:flex"
					onclick={onOpenPalette}
					aria-label="Open the algorithm palette"
				>
					<Command class="h-3.5 w-3.5" />
					<span>Search algorithms</span>
					<kbd class="gt-mono rounded border bg-muted px-1 text-[10px]">⌘K</kbd>
				</button>
				<Button
					variant="ghost"
					size="icon"
					class="md:hidden"
					onclick={onOpenPalette}
					title="Search algorithms"
					aria-label="Search algorithms"
				>
					<Command class="h-[1.2rem] w-[1.2rem]" />
				</Button>
				{#if onToggleBuilder}
					<Button variant="ghost" size="icon" class="md:hidden" onclick={onToggleBuilder} title="Open problem builder" aria-label="Open problem builder">
						<PanelLeft class="h-[1.2rem] w-[1.2rem]" />
					</Button>
				{/if}
				{#if onToggleInspector}
					<Button variant="ghost" size="icon" class="md:hidden" onclick={onToggleInspector} title="Open details panel" aria-label="Open details panel">
						<PanelRight class="h-[1.2rem] w-[1.2rem]" />
					</Button>
				{/if}
				<Button variant="ghost" size="icon" onclick={onOpenShortcuts} title="Keyboard Shortcuts" aria-label="Keyboard shortcuts">
					<Keyboard class="h-[1.2rem] w-[1.2rem]" />
					<span class="sr-only">Keyboard Shortcuts</span>
				</Button>
				<ThemeToggle />
			</nav>
		</div>
	</div>
</header>
