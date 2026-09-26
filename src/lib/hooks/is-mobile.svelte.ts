import { MediaQuery } from "svelte/reactivity";

/**
 * The widths at which the side panels stop overlaying the canvas and start
 * docking beside it.
 *
 * Both are `lg`/`xl` in CSS, and every `md:` in the sidebar was changed to `lg:`
 * to match - otherwise the CSS branch and the DOM branch disagree and one of the
 * two presentations is never reachable.
 *
 * They are two numbers rather than one because the shell is three columns and the
 * canvas is the product. Docking the builder alone costs 288px and leaves a
 * 736px canvas at 1024, which frames a 30x40 maze at about 18px per cell. Docking
 * the details panel as well costs another 352px and leaves 448px - about 10px per
 * cell, which is too small to paint a wall or to see two similar frontiers apart.
 * So the builder docks as soon as there is room for it and the details panel only
 * joins it when the canvas can afford to give up the space.
 */
export const BUILDER_BREAKPOINT = 1024;
export const DETAILS_BREAKPOINT = 1280;

export class IsMobile extends MediaQuery {
	constructor(breakpoint: number = BUILDER_BREAKPOINT) {
		super(`max-width: ${breakpoint - 1}px`);
	}
}
