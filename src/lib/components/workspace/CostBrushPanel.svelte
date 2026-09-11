<script lang="ts">
	import { editorState } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	
	const PRESETS = [2, 3, 5, 10, 20];

	function setCost(w: number) {
		editorState.costValue = w;
	}
</script>

<div class="flex flex-col gap-4 p-4 border rounded-md bg-card">
	<div class="space-y-2">
		<Label>Cost Brush Value</Label>
		<div class="flex flex-wrap gap-2">
			{#each PRESETS as preset}
				<Button
					variant={editorState.costValue === preset ? "default" : "outline"}
					size="sm"
					class="w-10 h-8 p-0"
					onclick={() => setCost(preset)}
				>
					{preset}
				</Button>
			{/each}
		</div>
	</div>
	
	<div class="flex items-center gap-3">
		<Label for="custom-cost" class="whitespace-nowrap">Custom Cost:</Label>
		<Input
			id="custom-cost"
			type="number"
			min="1"
			max="999"
			class="h-8 w-24"
			bind:value={editorState.costValue}
		/>
	</div>

	<div class="pt-2 border-t flex items-center justify-between">
		<Label for="show-costs" class="cursor-pointer">Show Cost Heatmap (A*)</Label>
		<Switch
			id="show-costs"
			checked={environmentState.showCosts}
			onCheckedChange={(v) => environmentState.showCosts = v}
		/>
	</div>
</div>
