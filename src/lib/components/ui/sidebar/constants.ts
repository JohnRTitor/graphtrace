/**
 * Sidebar geometry.
 *
 * `SIDEBAR_WIDTH` is denser than shadcn's 16rem default because this panel is a
 * dense three-column instrument: it holds tabs of form controls, not navigation.
 * `SIDEBAR_WIDTH_MOBILE` is capped at 88vw rather than fixed, so the sheet leaves
 * a visible strip of the canvas behind it to tap in order to dismiss.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "18rem";
export const SIDEBAR_WIDTH_MOBILE = "min(20rem, 90vw)";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
