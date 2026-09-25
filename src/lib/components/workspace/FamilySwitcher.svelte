<script lang="ts">
	import { environmentState } from '$lib/state/environment.svelte';
	import { families } from '$lib/families/registry';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/components/ui/tooltip';

	/**
	 * The family switcher.
	 *
	 * Family is the app's top-level mental model, so it is a segmented control in
	 * the header rather than a dropdown buried in a panel. Unbuilt families are
	 * shown disabled and labelled "Soon": their presence is the point - it makes
	 * visible that the top level is a registry, not a hardcoded pair of choices.
	 */
</script>

<TooltipProvider delayDuration={300}>
	<div
		class="flex items-center gap-1 rounded-lg border bg-card p-1 gt-transition-state"
		role="group"
		aria-label="Problem family"
	>
		{#each families as family (family.id)}
			{@const active = environmentState.familyId === family.id}
			{@const planned = family.status === 'planned'}
			<Tooltip>
				<!--
					The trigger *is* the button. Nesting a <button> inside it would
					produce a button inside a button, which is invalid HTML and is
					reported by bits-ui during server render.
				-->
				<TooltipTrigger
					class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium gt-transition-state disabled:cursor-not-allowed {active
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground'} {planned ? 'opacity-60' : ''}"
					disabled={planned}
					aria-pressed={active}
					aria-label={family.name}
					onclick={() => (environmentState.familyId = family.id)}
				>
					<family.icon class="h-4 w-4" />
					<span class="hidden md:inline">{family.name}</span>
					{#if planned}
						<span class="rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wide">Soon</span>
					{/if}
				</TooltipTrigger>
				<TooltipContent side="bottom">
					<span class="block max-w-56">{family.description}</span>
				</TooltipContent>
			</Tooltip>
		{/each}
	</div>
</TooltipProvider>
