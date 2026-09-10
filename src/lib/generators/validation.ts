import type { Grid } from "../graph/types";

export type MazeValidationResult = {
  connected: boolean;
  nodeCount: number;
  edgeCount: number;
  cycleCount: number;
  isPerfectMaze: boolean;
};

export function validateMaze(grid: Grid): MazeValidationResult {
  // 1. Find all walkable nodes
  const walkableNodes = new Set<string>();
  let startNodeId: string | null = null;

  for (const [id, node] of grid.nodes.entries()) {
    if (node.walkable) {
      walkableNodes.add(id);
      if (!startNodeId) {
        startNodeId = id;
      }
    }
  }

  if (walkableNodes.size === 0) {
    return {
      connected: true,
      nodeCount: 0,
      edgeCount: 0,
      cycleCount: 0,
      isPerfectMaze: true,
    };
  }

  // 2. Perform DFS/BFS to find connected components and count edges
  const visited = new Set<string>();
  let edges = 0; // Each undirected edge will be counted twice during traversal
  let components = 0;

  const dirs = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];

  for (const startId of walkableNodes) {
    if (visited.has(startId)) continue;
    
    components++;
    const stack: string[] = [startId];
    visited.add(startId);

    while (stack.length > 0) {
      const currId = stack.pop()!;
      const currNode = grid.nodes.get(currId)!;

      for (const [dr, dc] of dirs) {
        const nr = currNode.row + dr;
        const nc = currNode.col + dc;
        const neighborId = `${nr},${nc}`;

        if (walkableNodes.has(neighborId)) {
          edges++; // Count directed edge (curr -> neighbor)
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            stack.push(neighborId);
          }
        }
      }
    }
  }

  // Since the graph is undirected, each edge is counted in both directions
  const undirectedEdgeCount = edges / 2;
  const nodeCount = walkableNodes.size;
  const connected = components <= 1 && nodeCount > 0;

  // For C components, E = V - C + Cycles
  // Cycles = E - V + C
  const cycleCount = undirectedEdgeCount - nodeCount + components;

  return {
    connected,
    nodeCount,
    edgeCount: undirectedEdgeCount,
    cycleCount,
    isPerfectMaze: connected && cycleCount === 0,
  };
}
