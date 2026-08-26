import type { Grid, NodeId } from '$lib/graph/types';
import type { VisualizationState } from '$lib/visualization/types';

export interface ViewportTransform {
    x: number;
    y: number;
    scale: number;
}
