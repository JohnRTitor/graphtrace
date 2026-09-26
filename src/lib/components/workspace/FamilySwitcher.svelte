<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { families } from '$lib/families/registry';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Tooltip, TooltipContent, TooltipProvider } from '$lib/components/ui/tooltip';

	/**
	 * The family switcher.
	 *
	 * Family is the app's top-level mental model, so it is a segmented control at
	 * the head of the shell rather than a dropdown buried in a panel. Unbuilt
	 * families are shown disabled and labelled "Soon": their presence is the
	 * point - it makes visible that the top level is a registry, not a hardcoded
	 * pair of choices.
	 *
	 * It lives in the top bar on every viewport rather than in the sidebar,
	 * because on a phone the sidebar is a sheet the user has to open to reach
	 * anything, and switching family is the one control that must never be two
	 * taps away.
	 *
	 * Below `sm` each entry is a square icon button, because four of them have to
	 * share a 320px bar with the panel toggles. The name is `sr-only` rather than
	 * merely absent, so it stays in the accessibility tree, and the tooltip
	 * carries the description. The labels return at `xl`, which is the first
	 * width where all four fit beside the rest of the bar.
	 */
</script>

<TooltipProvider delayDuration={300}>
	<ToggleGroup
		type="single"
		value={environmentState.familyId}
		onValueChange={(value) => {
			if (value) environmentState.familyId = value;
		}}
		variant="outline"
		size="default"
		aria-label="Problem family"
		class="rounded-lg border bg-card p-0.5"
	>
		{#each families as family (family.id)}
			{@const planned = family.status === 'planned'}
			<Tooltip>
				<ToggleGroupItem
					value={family.id}
					disabled={planned}
					aria-label={family.name}
					class="h-tap w-9 shrink-0 justify-center px-0 text-xs sm:w-auto sm:min-w-0 sm:justify-start sm:px-2.5 xl:text-[11px]"
				>
					<family.icon class="h-4 w-4" />
					<span class="sr-only xl:not-sr-only">{family.name}</span>
					<!--
						Never rendered as text. A visible "Soon" chip costs ~30px per
						unbuilt family, which is what pushes the labelled switcher past
						1280px; the disabled state and the tooltip say it instead.
					-->
					{#if planned}
						<span class="sr-only">Soon</span>
					{/if}
				</ToggleGroupItem>
				<TooltipContent side="bottom">
					<span class="block max-w-56">
						{family.name} - {family.description}
						{#if planned}
							<span class="mt-1 block opacity-70">Not built yet.</span>
						{/if}
					</span>
				</TooltipContent>
			</Tooltip>
		{/each}
	</ToggleGroup>
</TooltipProvider>
