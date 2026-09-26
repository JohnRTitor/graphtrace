<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { families } from '$lib/families/registry';
	import { searchAlgorithms } from './palette-search';
	import { algorithmBadges } from './algorithm-badges';
	import { Badge } from '$lib/components/ui/badge';
	import {
		CommandDialog,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList
	} from '$lib/components/ui/command';

	interface Props {
		open?: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

	// An empty query lists every algorithm grouped by family, which is the point
	// of grouping: 15-20 algorithms across families are navigable as a short
	// outline, where a flat <Select> would be a scroll.
	//
	// Every family is listed, not just the active one, so the palette doubles as
	// the way to change family. That makes a cross-family pick ordinary, and it is
	// `environmentState.selectedAlgorithmId` that has to carry the environment
	// across with it rather than leaving the family and the environment disagreeing.
	let query = $state('');
	let grouped = $derived(searchAlgorithms(query));

	// A family with no algorithms still deserves a slot, so the palette can say
	// "not built yet" rather than silently omitting it.
	let plannedGroups = $derived(
		families
			.filter((family) => family.status === 'planned')
			.map((family) => ({ family, events: family.eventKinds }))
	);

	function choose(id: string) {
		environmentState.selectedAlgorithmId = id;
		onOpenChange(false);
		query = '';
	}
</script>

<!--
	The algorithm palette.
	Built on `CommandDialog` rather than a bare `Dialog`, but with
	`shouldFilter={false}`: the ranking and the per-character match highlighting
	come from `palette-search.ts`, which is unit tested against a subsequence
	matcher and ranks a *prefix* match above a scattered one. bits-ui's own filter
	is a plain case-insensitive `includes`, which would be a regression in
	result quality in exchange for nothing.
	What `Command` does buy is the part that was hand-rolled badly: roving focus
	and `aria-activedescendant` keyboard navigation, an input that announces the
	list it controls, and one listbox instead of one per family. The visible
	`onKeydown` handler and the `role="listbox"`-on-a-`<ul>`-whose-options-are-
	-buttons markup are gone.
-->
<CommandDialog
	bind:open
	onOpenChange={onOpenChange}
	shouldFilter={false}
	title="Algorithm palette"
	description="Search and choose an algorithm. Results are grouped by problem family."
	class="top-1/2 -translate-y-1/2 sm:top-1/3 sm:translate-y-0 sm:max-w-xl"
>
	<CommandInput
		bind:value={query}
		placeholder="Search algorithms…"
		aria-label="Search algorithms"
	/>
	<CommandList class="max-h-[min(60dvh,28rem)]">
		{#each grouped as group (group.family.id)}
			<CommandGroup heading={group.family.name}>
				{#each group.hits as hit (hit.summary.id)}
					<CommandItem
						value={hit.summary.id}
						onSelect={() => choose(hit.summary.id)}
						class="h-auto items-start gap-3 py-2"
					>
						<span class="min-w-0 flex-1">
							<span class="flex items-center gap-1.5">
								<span class="truncate text-sm font-medium">
									{#each hit.summary.name.split('') as char, index (index)}
										{#if hit.matches.includes(index)}
											<mark class="bg-transparent font-semibold text-primary">{char}</mark>
										{:else}{char}{/if}
									{/each}
								</span>
								{#if environmentState.selectedAlgorithmId === hit.summary.id}
									<Badge variant="secondary" class="px-1 py-0 text-[9px]">current</Badge>
								{/if}
							</span>
							<span class="mt-1 flex flex-wrap items-center gap-1">
								<!-- Complexity and property badges appear wherever an
								     algorithm is listed, so the trade-off is visible before
								     the user commits to a run. Defined once in
								     `algorithm-badges.ts` and shared with the Algorithm tab. -->
								{#each algorithmBadges(hit.summary) as badge (badge.title)}
									<Badge
										variant="secondary"
										class="gt-mono px-1 py-px text-[10px] font-normal {badge.muted
											? 'text-muted-foreground'
											: 'text-foreground'}"
										title={badge.title}
									>
										{badge.label}
									</Badge>
								{/each}
							</span>
							<span class="mt-1 block text-xs text-muted-foreground">
								{hit.summary.description}
							</span>
						</span>
					</CommandItem>
				{/each}
			</CommandGroup>
		{/each}

		<CommandEmpty>No algorithm matches “{query}”.</CommandEmpty>

		{#if query.trim() === '' && plannedGroups.length > 0}
			{#each plannedGroups as group (group.family.id)}
				<CommandGroup heading={group.family.name}>
					<div class="px-2 pb-2 text-xs text-muted-foreground">
						<p>{group.family.description}</p>
						<p class="mt-1 flex flex-wrap gap-1">
							{#each group.events as kind (kind)}
								<Badge
									variant="secondary"
									class="gt-mono px-1 py-px text-[10px] font-normal text-muted-foreground"
								>
									{kind}
								</Badge>
							{/each}
						</p>
					</div>
				</CommandGroup>
			{/each}
		{/if}
	</CommandList>
</CommandDialog>
