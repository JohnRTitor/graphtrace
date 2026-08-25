<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	
	let { onOpenShortcuts } = $props<{ onOpenShortcuts: () => void }>();
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
	<div class="container flex h-14 items-center px-4 max-w-full">
		<div class="mr-4 flex">
			<a href="/" class="mr-6 flex items-center space-x-2">
				<span class="font-bold sm:inline-block">GraphTrace</span>
			</a>
		</div>
		<div class="flex flex-1 items-center justify-between space-x-2 md:justify-end">
			<div class="w-full flex-1 md:w-auto md:flex-none">
				<!-- Search or other header elements could go here -->
			</div>
			<nav class="flex items-center space-x-2">
				<Button variant="ghost" size="icon" onclick={onOpenShortcuts} title="Keyboard Shortcuts">
					<Keyboard class="h-[1.2rem] w-[1.2rem]" />
					<span class="sr-only">Keyboard Shortcuts</span>
				</Button>
				<ThemeToggle />
			</nav>
		</div>
	</div>
</header>
