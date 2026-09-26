<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import FamilySwitcher from '$lib/components/workspace/FamilySwitcher.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Kbd } from '$lib/components/ui/kbd';
	import { SidebarTrigger } from '$lib/components/ui/sidebar';
	import { toggleMode } from 'mode-watcher';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { Tooltip, TooltipContent } from '$lib/components/ui/tooltip';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import PanelRight from '@lucide/svelte/icons/panel-right';
	import Command from '@lucide/svelte/icons/command';
	import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
	import Search from '@lucide/svelte/icons/search';
	import SunMoon from '@lucide/svelte/icons/sun-moon';

	interface Props {
		onOpenShortcuts: () => void;
		onOpenPalette: () => void;
		onToggleDetails: () => void;
		detailsOpen: boolean;
	}

	let { onOpenShortcuts, onOpenPalette, onToggleDetails, detailsOpen }: Props = $props();
</script>

<!--
	The top bar.

	Sized from a budget, not a wish. At 320px the row has room for about six
	44px controls, and the family switcher already spends four of them - it stays
	visible at every width because switching family is the one action that must
	never be two taps away. Everything below that priority order is what gives:
	from `sm` the wordmark and the theme toggle return, at `xl` the family
	labels appear, and what is left lives in the overflow menu.

	Density is inverted on purpose. Controls are *larger* on a coarse pointer
	than on a mouse, because a phone has no cursor to aim with; `--tap` carries
	that switch and the classes below are written in terms of it.
-->
<header
	class="z-50 w-full shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
>
	<div class="flex h-header w-full min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-4">
		<div class="lg:hidden">
			<SidebarTrigger class="h-tap w-tap" />
		</div>

		<a href="/" class="hidden min-w-0 items-center sm:flex">
			<span class="truncate text-sm font-semibold tracking-tight">GraphTrace</span>
		</a>

		<div class="shrink">
			<FamilySwitcher />
		</div>

		<div class="flex min-w-0 flex-1 justify-end">
			<nav class="flex items-center gap-1 sm:gap-1.5">
				<Button
					variant="outline"
					size="sm"
					class="hidden h-9 gap-2 px-2.5 text-xs text-muted-foreground hover:text-foreground xl:inline-flex"
					onclick={onOpenPalette}
				>
					<Search class="h-3.5 w-3.5" />
					<span>Search algorithms</span>
					<Kbd class="px-1 text-[10px]">⌘K</Kbd>
				</Button>

				<Tooltip>
					<Button
						variant="ghost"
						size="icon"
						class="h-tap w-tap hidden sm:inline-flex xl:hidden"
						onclick={onOpenPalette}
						aria-label="Search algorithms"
					>
						<Command class="h-[1.2rem] w-[1.2rem]" />
					</Button>
					<TooltipContent side="bottom">Search algorithms (⌘K)</TooltipContent>
				</Tooltip>

				<Tooltip>
					<Button
						variant="ghost"
						size="icon"
						class="h-tap w-tap"
						onclick={onToggleDetails}
						aria-label={detailsOpen ? 'Hide details panel' : 'Show details panel'}
						aria-expanded={detailsOpen}
					>
						<PanelRight class="h-[1.2rem] w-[1.2rem]" />
					</Button>
					<TooltipContent side="bottom">
						{detailsOpen ? 'Hide' : 'Show'} inspector, metrics and legend
					</TooltipContent>
				</Tooltip>

				<div class="hidden sm:block">
					<ThemeToggle class="h-tap w-tap" />
				</div>

				<Tooltip>
					<Button
						variant="ghost"
						size="icon"
						class="h-tap w-tap hidden sm:inline-flex"
						onclick={onOpenShortcuts}
						aria-label="Keyboard shortcuts"
					>
						<Keyboard class="h-[1.2rem] w-[1.2rem]" />
					</Button>
					<TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
				</Tooltip>

				<!--
					The trigger is hidden from `sm` up, where the theme and shortcuts
					buttons above it are both present. Hiding the trigger rather than its
					items matters: a menu whose items are `display: none` still collects
					them for its roving focus, and a `hidden` wrapper between
					`role="menu"` and `role="menuitem"` is invalid ARIA. So the two items
					are always the same two, and the menu is simply unreachable where the
					buttons exist.
				-->
				<DropdownMenu>
					<DropdownMenuTrigger
						class="inline-flex h-tap w-tap items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none data-[state=open]:bg-muted sm:hidden"
					>
						<MoreHorizontal class="h-[1.2rem] w-[1.2rem]" />
						<span class="sr-only">More actions</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" class="w-56">
						<DropdownMenuItem onclick={onOpenShortcuts}>
							<Keyboard class="h-4 w-4" />
							Keyboard shortcuts
						</DropdownMenuItem>
						<DropdownMenuItem onclick={toggleMode}>
							<SunMoon class="h-4 w-4" />
							Toggle theme
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</nav>
		</div>
	</div>
</header>
