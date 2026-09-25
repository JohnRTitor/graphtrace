<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { playbackState } from '$lib/state/playback.svelte';

	/**
	 * The legend.
	 *
	 * The five swatches are the same five colours in every family, and the same
	 * five meanings. What changes is the *label* the active family attaches to
	 * each one, which is why the legend is generated rather than written: a user
	 * moving from pathfinding to adversarial search should see that "frontier"
	 * became "pending" without having to relearn the colour.
	 */
	let family = $derived(environmentState.family);
	let entries = $derived(family?.legend() ?? []);

	let counts = $derived.by(() => {
		const tree = playbackState.gameTreeState;
		if (!tree) return null;
		return {
			pending: null,
			visited: tree.visited.size,
			current: tree.current ? 1 : 0,
			path: tree.principalVariation.length,
			pruned: tree.pruned.size
		};
	});
</script>

<div class="space-y-4 p-4">
	<h2 class="text-sm font-semibold tracking-tight">Legend</h2>

	{#if family && family.status === 'planned'}
		<p class="text-sm text-muted-foreground">
			{family.name} is registered but not built yet, so it has no trace states to
			describe.
		</p>
	{:else if entries.length === 0}
		<p class="text-sm text-muted-foreground">This family declares no trace states.</p>
	{:else}
		<p class="text-xs leading-relaxed text-muted-foreground">
			These five colours mean the same thing in every family, and are never used
			for anything else.
		</p>

		<dl class="space-y-2.5">
			{#each entries as entry (entry.token)}
				{@const liveCount = counts?.[
					entry.token === 'frontier' ? 'pending' : entry.token === 'path' ? 'path' : entry.token
				] ?? null}
				<div class="flex gap-2.5">
					<span
						class="gt-trace-swatch mt-0.5"
						style:background-color={`var(--trace-${entry.token})`}
						style:opacity={entry.token === 'pruned' ? '0.55' : '1'}
					></span>
					<div class="min-w-0 flex-1">
						<dt class="flex items-baseline justify-between gap-2 text-xs font-medium">
							<span>{entry.label}</span>
							{#if liveCount !== null}
								<span class="gt-mono text-[10px] font-normal text-muted-foreground">{liveCount}</span>
							{/if}
						</dt>
						<dd class="text-xs leading-relaxed text-muted-foreground">{entry.description}</dd>
					</div>
				</div>
			{/each}
		</dl>

		<!--
			The reserved vocabulary is fixed. Showing the unused state explicitly
			stops a user wondering whether a missing swatch is a bug, and keeps the
			set of five visibly closed.
		-->
		{#if !entries.some((entry) => entry.token === 'pruned')}
			<div class="flex gap-2.5 border-t pt-2.5 opacity-60">
				<span
					class="gt-trace-swatch mt-0.5"
					style:background-color="var(--trace-pruned)"
					style:opacity="0.55"
				></span>
				<div>
					<dt class="text-xs font-medium">Pruned</dt>
					<dd class="text-xs leading-relaxed text-muted-foreground">
						Unused by this family. Reserved so the meaning stays fixed.
					</dd>
				</div>
			</div>
		{/if}

		<p class="border-t pt-2 text-[11px] text-muted-foreground">
			The palette is colourblind-safe: the five states stay distinguishable in
			greyscale and under deuteranopia, and each is also distinguished by fill
			style or shape where it matters.
		</p>
	{/if}
</div>
