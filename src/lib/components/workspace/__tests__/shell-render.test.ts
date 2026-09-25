import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../../../../routes/+page.svelte';
import FamilySwitcher from '../FamilySwitcher.svelte';
import DetailsPanel from '../DetailsPanel.svelte';
import PrimaryToolbar from '../PrimaryToolbar.svelte';
import PlaybackControls from '../../PlaybackControls.svelte';
import ComparisonView from '../ComparisonView.svelte';
import AlgorithmPalette from '../AlgorithmPalette.svelte';
import { families } from '../../../families/registry';
import { environmentState } from '../../../state/environment.svelte';
import { editorState } from '../../../state/editor.svelte';

/**
 * Server-render smoke tests.
 *
 * These exist because `svelte-check` passes happily on a component that throws
 * at runtime - a `Tooltip.Root` rendered outside its `Tooltip.Provider` type
 * checks fine and 500s the page. Rendering the shell server-side catches that
 * class of bug in CI rather than on someone's first click.
 *
 * `render` throws if anything in the tree throws, so most of these are an
 * assertion that it did not.
 */

/**
 * Visible text of a render, with all whitespace removed.
 *
 * Whitespace has to go entirely rather than be collapsed: the algorithm palette
 * renders each character of a name in its own element so it can highlight
 * matches, so a name arrives interleaved with layout whitespace. Entities are
 * decoded for the same reason - a family called "Sorting & DP" must be findable
 * by the name it is displayed under.
 */
const textOf = (html: string) =>
	html
		.replace(/<script[\s\S]*?<\/script>/g, ' ')
		.replace(/<style[\s\S]*?<\/style>/g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/\s+/g, '');

const contains = (html: string, needle: string) =>
	textOf(html)
		.toLowerCase()
		// The needle is stripped the same way as the haystack, so a name containing
		// a space can still be found in text that was whitespace-collapsed.
		.includes(needle.toLowerCase().replace(/\s+/g, ''));

describe('app shell renders', () => {
	it('renders the whole page', () => {
		const { body } = render(Page);

		expect(contains(body, 'GraphTrace')).toBe(true);
	});

	it('renders the family switcher with every family, built or not', () => {
		const { body } = render(FamilySwitcher);

		for (const family of families) {
			expect(contains(body, family.name), `${family.name} is missing from the switcher`).toBe(true);
		}
		// Unbuilt families must be visibly marked, not silently absent.
		expect(textOf(body).match(/soon/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
	});

	it('renders the toolbar, including tooltips that need their provider', () => {
		expect(() => render(PrimaryToolbar)).not.toThrow();
	});

	it('renders the transport with the trace timeline', () => {
		const { body } = render(PlaybackControls);

		expect(contains(body, 'Playback')).toBe(true);
		expect(contains(body, 'Speed')).toBe(true);
	});

	it('renders the unified details panel with all three tabs', () => {
		const { body } = render(DetailsPanel);

		expect(contains(body, 'Inspector')).toBe(true);
		expect(contains(body, 'Metrics')).toBe(true);
		expect(contains(body, 'Legend')).toBe(true);
	});

	it('renders the algorithm palette without throwing, open or closed', () => {
		// The palette's content is portalled and unmounted while closed, so SSR
		// cannot assert on it. What it can assert is that opening it does not
		// throw, which is the class of bug that 500s the page.
		const props = { onOpenChange: () => {} };
		expect(() => render(AlgorithmPalette, { props })).not.toThrow();
		expect(() => render(AlgorithmPalette, { props: { ...props, open: true } })).not.toThrow();
	});

	it('emits no invalid-placement warnings from the shell', () => {
		// A <button> inside a <button> type-checks fine and renders fine, but it is
		// invalid HTML and bits-ui reports it during server render. Rendering is the
		// only thing that surfaces it.
		//
		// Checked one render at a time rather than in a loop: the shell components
		// have different prop types, and a heterogeneous array would need a cast that
		// would defeat the point of the check.
		const renders = [
			render(FamilySwitcher),
			render(PrimaryToolbar),
			render(DetailsPanel),
			render(PlaybackControls)
		];

		for (const result of renders) {
			expect(result.head).not.toContain('node_invalid_placement_ssr');
			expect(result.body).not.toBe('');
		}
	});

	it('renders the comparison view with no panes rather than crashing', () => {
		// With nothing mounted the grid is empty; the point is that it does not throw.
		expect(() => render(ComparisonView)).not.toThrow();
	});

	describe('tool strip', () => {
		/**
		 * The strip used to hard-code which tools to show per family, while the
		 * editor validated the active tool with a separate rule. The two could
		 * disagree, and did: the strip rendered with none of its buttons active and
		 * clicks on the canvas did nothing, which read as a broken wall brush.
		 *
		 * Tools are icon-only, so they are identified by their accessible label
		 * rather than by text content.
		 */
		const labels = (body: string) =>
			Array.from(body.matchAll(/aria-label="([^"]+)"/g)).map((match) => match[1]);

		const activeTool = (body: string) => {
			// A selected toggle item is marked `data-state="on"`; grab its label.
			const on = body.match(/data-state="on"[^>]*aria-label="([^"]+)"/);
			if (on) return on[1];
			const reversed = body.match(/aria-label="([^"]+)"[^>]*data-state="on"/);
			return reversed?.[1] ?? null;
		};

		it('always renders exactly one active tool for a grid', () => {
			environmentState.familyId = 'pathfinding';
			environmentState.environmentType = 'perfect_maze';
			editorState.mode = 'remove'; // a graph-only tool, carried over

			const { body } = render(PrimaryToolbar);

			expect(activeTool(body)).toBe('Draw Walls');
		});

		it('shows the wall and erase tools on a grid', () => {
			environmentState.familyId = 'pathfinding';
			environmentState.environmentType = 'blank';
			editorState.mode = 'wall';

			const found = labels(render(PrimaryToolbar).body);

			expect(found).toContain('Draw Walls');
			expect(found).toContain('Erase');
			expect(found).not.toContain('Add Edge');
		});

		it('shows topology tools on a manual graph', () => {
			environmentState.familyId = 'pathfinding';
			environmentState.environmentType = 'graph';
			editorState.mode = 'wall'; // a grid-only tool, carried over

			const { body } = render(PrimaryToolbar);
			const found = labels(body);

			expect(found).toContain('Add Node');
			expect(found).toContain('Add Edge');
			expect(found).not.toContain('Draw Walls');
			expect(activeTool(body)).toBe('Add Node');
		});

		it('offers no paint or marker tools on a game tree', () => {
			environmentState.familyId = 'adversarial';
			environmentState.environmentType = 'manual_tree';
			editorState.mode = 'wall';

			const { body } = render(PrimaryToolbar);
			const found = labels(body);

			expect(found).not.toContain('Draw Walls');
			expect(found).not.toContain('Erase');
			expect(found).not.toContain('Set Start');
			expect(found).not.toContain('Set Goal');
			expect(found).toContain('Remove');
			expect(activeTool(body)).toBe('Remove');
		});

		it('keeps exactly one tool active through a family round trip', () => {
			environmentState.familyId = 'pathfinding';
			environmentState.environmentType = 'perfect_maze';
			editorState.mode = 'wall';
			expect(activeTool(render(PrimaryToolbar).body)).toBe('Draw Walls');

			environmentState.familyId = 'adversarial';
			expect(activeTool(render(PrimaryToolbar).body)).toBe('Remove');

			environmentState.familyId = 'pathfinding';
			expect(activeTool(render(PrimaryToolbar).body)).toBe('Draw Walls');
		});
	});
});
