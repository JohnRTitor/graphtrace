<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { environmentState } from '$lib/state/environment.svelte';
	import { families } from '$lib/families/registry';
	import { flatten, moveSelection, searchAlgorithms } from './palette-search';
	import { algorithmBadges } from './algorithm-badges';
	import { Badge } from '$lib/components/ui/badge';
	import Search from '@lucide/svelte/icons/search';
	import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';

	interface Props {
		open?: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { open = $bindable(false), onOpenChange }: Props = $props();

	let query = $state('');
	let selected = $state(0);

	// An empty query lists every algorithm grouped by family, which is the point
	// of grouping: 15-20 algorithms across families are navigable as a short
	// outline, where a flat <Select> would be a scroll.
	//
	// Every family is listed, not just the active one, so the palette doubles as
	// the way to change family. That makes a cross-family pick ordinary, and it is
	// `environmentState.selectedAlgorithmId` that has to carry the environment
	// across with it rather than leaving the family and the environment disagreeing.
	let grouped = $derived(searchAlgorithms(query));
	let flat = $derived(flatten(grouped));

	// A family with no algorithms still deserves a slot, so the palette can say
	// "not built yet" rather than silently omitting it.
	let plannedGroups = $derived(
		families
			.filter((family) => family.status === 'planned')
			.map((family) => ({
				family,
				hits: [],
				events: family.eventKinds
			}))
	);

	function choose(id: string) {
		environmentState.selectedAlgorithmId = id;
		onOpenChange(false);
		query = '';
		selected = 0;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selected = moveSelection(grouped, selected, 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selected = moveSelection(grouped, selected, -1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const hit = flat[selected];
			if (hit) choose(hit.summary.id);
		}
	}

	$effect(() => {
		// Re-clamp whenever the result set changes, so a query narrowing to nothing
		// cannot leave the selection pointing past the end of the list.
		if (selected >= flat.length) selected = Math.max(0, flat.length - 1);
	});

	let runningIndex = $derived.by(() => {
		let index = 0;
		const rows: number[] = [];
		for (const group of grouped) {
			for (const _hit of group.hits) {
				rows.push(index);
				index++;
			}
		}
		return rows;
	});
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent
		class="max-w-xl gap-0 overflow-hidden p-0"
		onkeydown={onKeydown}
		aria-label="Algorithm palette"
	>
		<DialogHeader class="space-y-0 border-b p-3">
			<div class="flex items-center gap-2">
				<Search class="h-4 w-4 shrink-0 text-muted-foreground" />
				<input
					bind:value={query}
					placeholder="Search algorithms…"
					aria-label="Search algorithms"
					class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
				/>
				<kbd class="gt-mono rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
			</div>
			<DialogTitle class="sr-only">Algorithm palette</DialogTitle>
			<DialogDescription class="sr-only">
				Search and choose an algorithm. Results are grouped by problem family.
			</DialogDescription>
		</DialogHeader>

		<div class="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
			{#if grouped.length === 0}
				<p class="px-3 py-6 text-center text-sm text-muted-foreground">
					No algorithm matches “{query}”.
				</p>
			{/if}

			{#each grouped as group (group.family.id)}
				<section class="mb-2">
					<h3 class="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						<group.family.icon class="h-3.5 w-3.5" />
						{group.family.name}
					</h3>
					<ul role="listbox" aria-label={group.family.name}>
						{#each group.hits as hit, i (hit.summary.id)}
							{@const absolute = runningIndex[i]}
							<li role="option" aria-selected={absolute === selected}>
								<button
									type="button"
									class="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left gt-transition-feedback"
									class:bg-accent={absolute === selected}
									onmouseenter={() => (selected = absolute)}
									onclick={() => choose(hit.summary.id)}
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
												<span
													class="gt-mono rounded bg-muted px-1 py-px text-[10px] {badge.muted
														? 'text-muted-foreground'
														: 'text-foreground'}"
													title={badge.title}
												>
													{badge.label}
												</span>
											{/each}
										</span>
										<span class="mt-1 block text-xs text-muted-foreground">
											{hit.summary.description}
										</span>
									</span>
									{#if absolute === selected}
										<CornerDownLeft class="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			{#if query.trim() === '' && plannedGroups.length > 0}
				<div class="mt-1 border-t pt-2">
					{#each plannedGroups as group (group.family.id)}
						<div class="px-2 py-1.5">
							<h3 class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
								<group.family.icon class="h-3.5 w-3.5" />
								{group.family.name}
								<span class="rounded bg-muted px-1 py-px text-[9px] uppercase">Coming soon</span>
							</h3>
							<p class="mt-0.5 text-xs text-muted-foreground">{group.family.description}</p>
							<p class="mt-1 flex flex-wrap gap-1">
								{#each group.family.eventKinds as kind (kind)}
									<span class="gt-mono rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">{kind}</span>
								{/each}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
