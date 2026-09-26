<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import { Tooltip, TooltipContent } from '$lib/components/ui/tooltip';

	let { class: className = '' }: { class?: string } = $props();
</script>

<Tooltip>
	<Button
		onclick={toggleMode}
		variant="ghost"
		size="icon"
		class={className}
		aria-label="Toggle theme"
	>
		<Sun
			class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
		/>
		<Moon
			class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
		/>
	</Button>
	<TooltipContent side="bottom">Toggle light and dark</TooltipContent>
</Tooltip>
