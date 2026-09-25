<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { 
		open = $bindable(false),
		initialCost = 1,
		title = "Edit Cost",
		onSave
	}: {
		open: boolean;
		initialCost?: number;
		title?: string;
		onSave: (cost: number) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let costValue = $state(initialCost);

	// Sync initialCost to costValue when opened
	$effect(() => {
		if (open) {
			costValue = initialCost;
		}
	});

	function handleSave() {
		const val = Number(costValue);
		if (!Number.isFinite(val) || val < 0) return;
		onSave(val);
		open = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>
				Enter a numeric cost for this element. Higher costs make this path less desirable for algorithms that consider weights (like A* or Dijkstra).
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="cost" class="text-right">Cost</Label>
				<Input
					id="cost"
					type="number"
					min="0"
					inputmode="decimal"
					required
					bind:value={costValue}
					onkeydown={handleKeyDown}
					class="col-span-3"
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => open = false}>Cancel</Button>
			<Button type="button" onclick={handleSave}>Save changes</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
