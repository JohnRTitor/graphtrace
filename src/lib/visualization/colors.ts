export type ColorPalette = {
	gridLine: string;
	empty: string;
	wall: string;
	start: string;
	goal: string;
	discovered: string;
	expanded: string;
	current: string;
	path: string;
	weightText: string;
};

// These map to standard Tailwind/CSS colors or shadcn variables
// The renderer will try to read these from computed CSS variables for perfect theme sync,
// but these serve as fallbacks
export const defaultLightPalette: ColorPalette = {
	gridLine: 'rgba(0, 0, 0, 0.05)',
	empty: '#ffffff',
	wall: '#1e293b', // slate-800
	start: '#22c55e', // green-500
	goal: '#ef4444', // red-500
	discovered: '#bfdbfe', // blue-200 (in frontier)
	expanded: '#eff6ff', // blue-50 (visited)
	current: '#eab308', // yellow-500
	path: '#f59e0b', // amber-500
	weightText: '#94a3b8' // slate-400
};

export const defaultDarkPalette: ColorPalette = {
	gridLine: 'rgba(255, 255, 255, 0.05)',
	empty: '#0f172a', // slate-900
	wall: '#94a3b8', // slate-400
	start: '#22c55e', // green-500
	goal: '#ef4444', // red-500
	discovered: '#1e3a8a', // blue-900 (in frontier)
	expanded: '#1e293b', // slate-800 (visited)
	current: '#eab308', // yellow-500
	path: '#f59e0b', // amber-500
	weightText: '#475569' // slate-600
};

export function getThemePalette(): ColorPalette {
	if (typeof window === 'undefined') return defaultLightPalette;
	
	const isDark = document.documentElement.classList.contains('dark');
	return isDark ? defaultDarkPalette : defaultLightPalette;
}
