<script lang="ts">
	import { Sidebar, SidebarContent, useSidebar } from '$lib/components/ui/sidebar';
	import {
		SheetClose,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import ProblemBuilderPanel from '$lib/components/workspace/ProblemBuilderPanel.svelte';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		onOpenPalette: () => void;
	}

	let { onOpenPalette }: Props = $props();

	const sidebar = useSidebar();
</script>

<!--
	The problem builder, as a real shadcn `Sidebar`.

	Not a hand-rolled `<aside>`: what lived there before was a drawer - a fixed
	panel, a toggled `hidden` class, a scrim `<button>`, and no focus trap, no
	escape handling and no body scroll lock. The sidebar brings all of that with
	it, and below the docking width it is this same component rendered as a sheet,
	so the mobile and desktop builders can never disagree about what they show.

	Docking happens at `lg`, not shadcn's default `md`: this shell is three
	columns, and two 288px panels at 768px leave the canvas 128px wide.
-->
<Sidebar collapsible="offcanvas" class="border-r">
	<SidebarContent class="no-scrollbar overflow-hidden">
		<!--
			A sheet needs a title for assistive technology, and on a phone a way out
			that is not a tap on the scrim. On the desktop branch there is no dialog
			to close, so neither is rendered - which is why this is gated on
			`isMobile` rather than merely hidden with `lg:hidden`.
		-->
		{#if sidebar.isMobile}
			<SheetHeader
				class="flex-row items-start justify-between gap-2 border-b p-3"
			>
				<div class="min-w-0">
					<SheetTitle class="text-sm">Problem</SheetTitle>
					<SheetDescription class="text-xs text-muted-foreground">
						Choose an algorithm, an environment and its parameters.
					</SheetDescription>
				</div>
				<SheetClose>
					{#snippet child({ props })}
						<Button variant="ghost" size="icon-sm" {...props}>
							<X class="h-4 w-4" />
							<span class="sr-only">Close</span>
						</Button>
					{/snippet}
				</SheetClose>
			</SheetHeader>
		{/if}

		<ProblemBuilderPanel {onOpenPalette} />
	</SidebarContent>
</Sidebar>
