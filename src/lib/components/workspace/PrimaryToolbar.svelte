<script lang="ts">
	import { editorState, availableEditModes, type EditMode } from '$lib/state/editor.svelte';
	import { environmentState } from '$lib/state/environment.svelte';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '$lib/components/ui/tooltip';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';

	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Flag from '@lucide/svelte/icons/flag';
	import Target from '@lucide/svelte/icons/target';
	import Weight from '@lucide/svelte/icons/weight';
	import Circle from '@lucide/svelte/icons/circle';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Move from '@lucide/svelte/icons/move';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Save from '@lucide/svelte/icons/save';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Columns2 from '@lucide/svelte/icons/columns-2';
	import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
	import { serializeWorkspace, deserializeWorkspace } from '$lib/persistence/save-load';
	import { executionStore } from '$lib/state/execution-store.svelte';
	import { comparePlaybackStates } from '$lib/state/playback.svelte';

	import CostBrushPanel from './CostBrushPanel.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);
	let loadError = $state<string | null>(null);

	/**
	 * The tools are derived from `availableEditModes`, the same function the editor
	 * uses to validate the active mode. Strip and state therefore cannot disagree:
	 * whatever the strip renders, clicking the canvas will act on, and one of the
	 * buttons is always highlighted.
	 */
	let tools = $derived(availableEditModes(environmentState.environmentType));

	const TOOL_ICONS: Record<EditMode, typeof MousePointer2> = {
		wall: MousePointer2,
		erase: Eraser,
		start: Flag,
		goal: Target,
		cost: Weight,
		node: Circle,
		edge: ArrowRight,
		remove: Trash2,
		move: Move
	};

	const TOOL_LABELS: Record<EditMode, string> = {
		wall: 'Draw Walls',
		erase: 'Erase',
		start: 'Set Start',
		goal: 'Set Goal',
		cost: 'Cost Brush',
		node: 'Add Node',
		edge: 'Add Edge',
		remove: 'Remove',
		move: 'Move Node'
	};

	/** Dividers between the "paint", "markers" and "cost" groups. */
	const DIVIDERS_AFTER = new Set<EditMode>(['erase', 'goal']);

	function handleSave() {
		const json = serializeWorkspace(environmentState);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `graphtrace-workspace-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	function handleLoad(e: Event) {
		loadError = null;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onerror = () => {
			loadError = 'Unable to read the selected workspace file.';
		};
		reader.onload = (e) => {
			try {
				const json = e.target?.result as string;
				deserializeWorkspace(json, environmentState);
				// No mode reconciliation needed: the editor resolves the active tool against
				// the environment on read, so a loaded workspace cannot leave a tool
				// selected that the loaded environment cannot act on.
			} catch (err) {
				loadError = err instanceof Error ? err.message : 'Unable to load the selected workspace.';
			}
		};
		reader.readAsText(file);
		// Reset input so the same file can be loaded again if needed
		target.value = '';
	}

	function toggleComparison() {
		if (!executionStore.isComparing) {
			for (const pane of comparePlaybackStates) pane.pause();
		}
		executionStore.isComparing = !executionStore.isComparing;
	}
</script>

<!--
	The canvas toolbar.

	One row, never two. The tool strip is the part that has to be always visible,
	so it is a single horizontally scrollable row; the document actions are
	frequent enough on a desktop to stay inline from `sm` and rare enough on a
	phone to collapse into one overflow button. A wrapping toolbar grew to three
	rows on a 390px screen and took a fifth of the canvas with it.
-->
<div class="z-20 flex shrink-0 flex-col border-b bg-card">
	{#if loadError}
		<div class="px-2 pt-2">
			<Alert variant="destructive" role="alert" class="rounded-lg py-2">
				<AlertDescription class="text-xs">{loadError}</AlertDescription>
			</Alert>
		</div>
	{/if}

	<TooltipProvider delayDuration={300}>
		<div class="flex items-center gap-2 p-2">
			<div class="gt-scroll-x min-w-0 flex-1">
				<ToggleGroup
					type="single"
					value={editorState.mode}
					onValueChange={(v) => { if (v) editorState.mode = v as EditMode; }}
					variant="outline"
					class="w-max justify-start gap-1"
				>
					{#each tools as tool (tool)}
						{@const Icon = TOOL_ICONS[tool]}
						<ToggleGroupItem
							value={tool}
							aria-label={TOOL_LABELS[tool]}
							title={TOOL_LABELS[tool]}
							class="h-tap w-tap sm:h-9 sm:w-9"
						>
							<span class={tool === 'goal' ? 'text-red-500' : tool === 'start' ? 'text-green-500' : ''}>
								<Icon class="h-4 w-4" />
							</span>
						</ToggleGroupItem>
						{#if DIVIDERS_AFTER.has(tool)}
							<div class="mx-1 h-6 w-px shrink-0 self-center bg-border"></div>
						{/if}
						{#if tool === 'cost'}
							<Popover>
								<PopoverTrigger
									aria-label="Open cost brush settings"
									class="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-3xl border border-input bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none data-[state=open]:bg-muted sm:h-9 sm:w-9"
								>
									<SlidersHorizontal class="h-3.5 w-3.5" />
								</PopoverTrigger>
								<PopoverContent
									class="w-[min(20rem,calc(100vw-2rem))]"
									side="bottom"
									align="start"
								>
									<CostBrushPanel />
								</PopoverContent>
							</Popover>
						{/if}
					{/each}
				</ToggleGroup>
			</div>

			<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleLoad} />

			<div class="hidden shrink-0 items-center gap-1.5 sm:flex">
				<Tooltip>
					<!-- The trigger is the button; see FamilySwitcher for why. -->
					<TooltipTrigger
						class="inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none aria-pressed:bg-accent aria-pressed:text-accent-foreground"
						aria-pressed={executionStore.isComparing}
						onclick={toggleComparison}
					>
						<Columns2 class="h-4 w-4" />
						Compare
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<span class="block max-w-56">
							Run a second algorithm to fill a comparison pane. Up to four panes, each
							driven from the same transport.
						</span>
					</TooltipContent>
				</Tooltip>

				<div class="mx-1 h-6 w-px bg-border"></div>

				<Button
					variant="outline"
					size="sm"
					class="h-9"
					onclick={() => fileInput?.click()}
				>
					<FolderOpen class="h-3.5 w-3.5" />
					Load
				</Button>
				<Button variant="outline" size="sm" class="h-9" onclick={handleSave}>
					<Save class="h-3.5 w-3.5" />
					Save
				</Button>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger
					class="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none data-[state=open]:bg-muted sm:hidden"
					aria-label="Workspace actions"
				>
					<MoreHorizontal class="h-4 w-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" class="w-48">
					<DropdownMenuItem onclick={toggleComparison}>
						<Columns2 class="h-4 w-4" />
						Compare
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onclick={() => fileInput?.click()}>
						<FolderOpen class="h-4 w-4" />
						Load workspace
					</DropdownMenuItem>
					<DropdownMenuItem onclick={handleSave}>
						<Save class="h-4 w-4" />
						Save workspace
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</TooltipProvider>
</div>
