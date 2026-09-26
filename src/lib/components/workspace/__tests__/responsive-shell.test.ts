import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from '../../../../routes/+page.svelte';
import EnvironmentSettings from '../EnvironmentSettings.svelte';
import PlaybackControls from '../../PlaybackControls.svelte';
import { environmentState } from '../../../state/environment.svelte';

/**
 * Guards for the layout decisions this shell is built on.
 *
 * Every one of these is a regression that actually happened: the first version of
 * this shell had a header wider than a 320px viewport with the theme toggle
 * clipped off the right edge, a native `<select>` in the middle of a
 * shadcn-styled panel, a transport bar floating over the bottom third of every
 * graph, and a set of 17px-tall jump controls that were the only way to navigate
 * a minimax trace. None of them are visible in review, and none of them are
 * caught by a unit test of the components themselves.
 */

const LIB = new URL('../../../', import.meta.url).pathname; // src/lib

/** First-party components. The shadcn primitives under `ui/` are excluded. */
function appSvelteFiles(dir: string = LIB, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry.startsWith('.') || entry === 'ui') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) appSvelteFiles(full, found);
		else if (entry.endsWith('.svelte')) found.push(full);
	}
	return found;
}

describe('shell layout invariants', () => {
	it('keeps the transport in normal flow so nothing floats over the canvas', () => {
		const { body } = render(Page);

		const dock = body.match(/<div data-slot="dock" class="([^"]*)"/);
		expect(dock, 'the dock is missing its data-slot hook').toBeTruthy();
		// A floating dock was the original design and it covered the graph.
		expect(dock?.[1]).not.toMatch(/absolute/);
		expect(dock?.[1]).toContain('shrink-0');
	});

	it('exposes the transport and the canvas as siblings of one flex column', () => {
		// Guards the structural decision: the canvas is `flex-1` and the dock is
		// `shrink-0` beside it, so the canvas can never be underneath the dock
		// however tall the transport grows.
		const source = readFileSync(join(LIB, '..', 'routes', '+page.svelte'), 'utf8');
		expect(source).toMatch(/<main class="flex min-w-0 flex-1 flex-col/);
		expect(source).toMatch(/class="relative min-h-0 flex-1 overflow-hidden"/);
	});

	it('docks the side panels at the same width the mobile sheet breaks at', () => {
		// `lg` in CSS has to agree with the `IsMobile` breakpoint the sidebar
		// branches on, or one of the two presentations is never reachable.
		const hook = readFileSync(join(LIB, 'hooks', 'is-mobile.svelte.ts'), 'utf8');
		expect(Number(hook.match(/BUILDER_BREAKPOINT = (\d+)/)?.[1])).toBe(1024);
		// The details panel docks later than the builder: three columns at 1024
		// leave the canvas 448px, which frames a maze at about 10px per cell.
		expect(Number(hook.match(/DETAILS_BREAKPOINT = (\d+)/)?.[1])).toBe(1280);

		const sidebar = readFileSync(join(LIB, 'components', 'ui', 'sidebar', 'sidebar.svelte'), 'utf8');
		// Every `md:` in the sidebar became `lg:` when the docking line moved.
		expect(sidebar).not.toMatch(/\bmd:(block|flex|peer-)/);
		expect(sidebar).toMatch(/lg:block/);
		expect(sidebar).toMatch(/lg:flex/);
	});
});

describe('no hand-rolled form controls outside the shadcn primitives', () => {
	it('has no native select anywhere in the app components', () => {
		const offenders = appSvelteFiles().filter((file) => /<select[\s>]/.test(readFileSync(file, 'utf8')));
		expect(offenders, 'a native <select> renders the OS widget and ignores the theme').toEqual([]);
	});

	it('has no raw checkbox or radio inputs in the app components', () => {
		// A boolean setting in this app is a `Switch`; a multi-choice one is a
		// `ToggleGroup` or `Select`. A bare `type="checkbox"` is none of those
		// and is styled by the browser, not by the theme.
		const offenders = appSvelteFiles().filter((file) =>
			/type=["'](checkbox|radio)["']/.test(readFileSync(file, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});

	/**
	 * `onselect` is a React-ism that Svelte's attribute typing accepts and
	 * bits-ui v2 never dispatches. It spread onto the element as an inert DOM
	 * listener, so a menu item wired to it type-checked, rendered, and did
	 * nothing - which is how the mobile Compare action ended up with a working
	 * menu item that never toggled comparison mode.
	 *
	 * The bits-ui spellings are camelCase and are listed here so the difference is
	 * visible: `onclick`, `onValueChange`, `onOpenChange`, `onCheckedChange`.
	 */
	it('uses only event names bits-ui actually dispatches', () => {
		const offenders = appSvelteFiles().filter((file) =>
			/\bonselect=/.test(readFileSync(file, 'utf8'))
		);
		expect(
			offenders,
			'bits-ui v2 dispatches onclick, not onselect; an onselect handler is inert'
		).toEqual([]);
	});

	it('renders the environment picker as a shadcn combobox', () => {
		environmentState.familyId = 'pathfinding';
		environmentState.environmentType = 'perfect_maze';

		const { body } = render(EnvironmentSettings);

		expect(body).toContain('data-slot="select-trigger"');
		expect(body).not.toContain('<select');
		// The friendly label, not the raw registry value.
		expect(body).toContain('Perfect Maze');
		expect(body).not.toContain('>perfect_maze<');
	});
});

describe('controls meet a minimum size', () => {
	/**
	 * The app declares its minimum tap target as `--tap` (44px on a coarse
	 * pointer, 36px on a mouse), exposed to Tailwind as `h-tap`. A literal
	 * pixel height in a first-party component is a control that was sized before
	 * anyone checked whether it could be hit.
	 */
	const TAP = 2.25; // rem; the mouse value, the smaller of the two

	const offenders: string[] = [];
	for (const file of appSvelteFiles()) {
		const source = readFileSync(file, 'utf8');
		// Only the interactive elements this app writes by hand.
		for (const match of source.matchAll(/<(button|select)\b([^>]*)>/g)) {
			const className = match[2].match(/class="([^"]*)"/)?.[1] ?? '';
			// A control that is deliberately invisible: a `sr-only` trigger, a
			// bits-ui internal, or one that carries a `h-`/`size-` from a
			// primitive's own variant.
			if (/sr-only/.test(className)) continue;
			const height = className.match(/(?:^|\s)h-(\d+(?:\.\d+)?)/);
			if (!height) continue;
			if (Number(height[1]) >= TAP) continue;
			offenders.push(`${file.replace(LIB, '')}: <${match[1]}> h-${height[1]}`);
		}
	}

	it('has no interactive element with an explicit height under the tap minimum', () => {
		expect(offenders, offenders.join('\n')).toEqual([]);
	});
});

describe('the transport dock stays compact', () => {
	it('keeps the dock compact and puts the secondary controls behind a disclosure', () => {
		// The strip plus the speed control is roughly a quarter of a phone's
		// height and none of it is needed to watch a trace play, so it is behind a
		// Collapsible that starts closed below the docking width. Source-level
		// because the strip only renders once a trace is loaded, which a
		// server-render of the component cannot produce.
		const source = readFileSync(join(LIB, 'components', 'PlaybackControls.svelte'), 'utf8');
		expect(source).toContain('Collapsible');
		expect(source).toContain('gt-scroll-x');
		expect(source).toContain('gap-2 sm:gap-3');

		// The transport itself is a ButtonGroup, so its four actions read as one
		// control rather than four unrelated buttons.
		const { body } = render(PlaybackControls);
		expect(body).toContain('data-slot="button-group"');
	});
});

describe('single-key shortcuts are only suppressed by overlays that own the keyboard', () => {
	/**
	 * The guard used to be `document.querySelector('[data-state="open"]')`, which
	 * also matches a `Collapsible`, a `Popover` and a tab panel. Adding a
	 * `Collapsible` to the transport dock therefore disabled Space, N, B, R and E
	 * everywhere in the app, silently, and nothing about it looked wrong.
	 */
	const layout = readFileSync(join(LIB, '..', 'routes', '+layout.svelte'), 'utf8');

	it('does not suppress shortcuts on a blanket open-state query', () => {
		expect(layout).not.toMatch(/querySelector\('\[data-state="open"\]'\)/);
	});

	it('scopes the guard to modals, menus and listboxes', () => {
		for (const selector of [
			'[role="dialog"][data-state="open"]',
			'[role="menu"][data-state="open"]',
			'[role="listbox"][data-state="open"]'
		]) {
			expect(layout).toContain(selector);
		}
	});

	it('has a Collapsible in the dock, which is exactly the element that broke it', () => {
		// Asserted so the two tests above cannot be satisfied by deleting the
		// Collapsible instead of fixing the selector.
		const dock = readFileSync(join(LIB, 'components', 'PlaybackControls.svelte'), 'utf8');
		expect(dock).toContain('Collapsible');
	});
});
