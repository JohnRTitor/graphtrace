<script lang="ts">
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';

	const PRESETS = [2, 3, 5, 10, 20];

	function setCost(w: number) {
		editorState.costValue = w;
	}
</script>

<!--
	The cost brush settings.

	A `ToggleGroup` rather than five buttons whose `variant` encoded the selection:
	one control now owns the selection, so it also owns the roving focus, the
	arrow-key behaviour and the `aria-checked` state, none of which the buttons
	had. The preset values are unchanged, including the gap between them - the
	costs are the point, and 3 and 5 are different numbers, not a range.
-->
<div class="flex flex-col gap-4 rounded-lg bg-card p-4">
	<div class="space-y-2">
		<Label id="cost-brush-label" class="text-xs">Cost brush value</Label>
		<ToggleGroup
			type="single"
			value={String(editorState.costValue)}
			onValueChange={(value) => {
				if (value) setCost(Number(value));
			}}
			variant="outline"
			aria-labelledby="cost-brush-label"
			class="w-full justify-start"
		>
			{#each PRESETS as preset}
				<ToggleGroupItem value={String(preset)} class="h-9 flex-1 text-xs sm:h-8">
					{preset}
				</ToggleGroupItem>
			{/each}
		</ToggleGroup>
	</div>

	<div class="flex items-center gap-3">
		<Label for="custom-cost" class="flex-1 text-xs">Custom cost</Label>
		<Input
			id="custom-cost"
			type="number"
			min="1"
			max="999"
			class="gt-mono h-11 w-24 sm:h-9"
			bind:value={editorState.costValue}
		/>
	</div>

	<div class="flex items-center justify-between border-t pt-3">
		<Label for="show-costs" class="cursor-pointer text-xs">Show cost heatmap (A*)</Label>
		<Switch
			id="show-costs"
			checked={environmentState.showCosts}
			onCheckedChange={(v) => (environmentState.showCosts = v)}
		/>
	</div>
</div>
