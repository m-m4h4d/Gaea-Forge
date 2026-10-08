// Hierarchical auto-layout for family tree canvases
import { CanvasConnection, CanvasNode } from './database';

export type FamilyTreeLayoutOptions = {
  rowHeight: number;
  columnWidth: number;
  centerX: number;
  topY: number;
};

const DEFAULT_OPTIONS: FamilyTreeLayoutOptions = {
  rowHeight: 220,
  columnWidth: 280,
  centerX: 350,
  topY: 100,
};

// Generation (row) of each node: children sit at least one row below every
// parent, and spouses share a row. Cycles are cut off after nodes.length passes.
export function computeGenerations(
  nodes: CanvasNode[],
  connections: CanvasConnection[]
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const levels = new Map(nodes.map((n) => [n.id, 0]));
  const relevant = connections.filter(
    (c) =>
      (c.relationship === 'parent-child' || c.relationship === 'spouse') &&
      ids.has(c.fromNodeId) &&
      ids.has(c.toNodeId)
  );

  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const c of relevant) {
      const from = levels.get(c.fromNodeId)!;
      const to = levels.get(c.toNodeId)!;
      if (c.relationship === 'parent-child') {
        if (to < from + 1) {
          levels.set(c.toNodeId, from + 1);
          changed = true;
        }
      } else if (from !== to) {
        const row = Math.max(from, to);
        levels.set(c.fromNodeId, row);
        levels.set(c.toNodeId, row);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return levels;
}

// Order nodes by walking each family from its roots (spouse next to partner,
// then children), so related nodes end up near each other within a row.
function familyOrder(nodes: CanvasNode[], connections: CanvasConnection[]): Map<string, number> {
  const children = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const c of connections) {
    if (c.relationship === 'parent-child') {
      children.set(c.fromNodeId, [...(children.get(c.fromNodeId) ?? []), c.toNodeId]);
      hasParent.add(c.toNodeId);
    } else if (c.relationship === 'spouse') {
      spouses.set(c.fromNodeId, [...(spouses.get(c.fromNodeId) ?? []), c.toNodeId]);
      spouses.set(c.toNodeId, [...(spouses.get(c.toNodeId) ?? []), c.fromNodeId]);
    }
  }

  const order = new Map<string, number>();
  const visit = (id: string) => {
    if (order.has(id)) return;
    order.set(id, order.size);
    (spouses.get(id) ?? []).forEach(visit);
    (children.get(id) ?? []).forEach(visit);
  };

  nodes.filter((n) => !hasParent.has(n.id)).forEach((n) => visit(n.id));
  nodes.forEach((n) => visit(n.id));
  return order;
}

// Returns new node objects positioned in centered rows by generation
export function layoutFamilyTree(
  nodes: CanvasNode[],
  connections: CanvasConnection[],
  options: Partial<FamilyTreeLayoutOptions> = {}
): CanvasNode[] {
  const { rowHeight, columnWidth, centerX, topY } = { ...DEFAULT_OPTIONS, ...options };
  const generations = computeGenerations(nodes, connections);
  const order = familyOrder(nodes, connections);

  const rows = new Map<number, CanvasNode[]>();
  for (const node of nodes) {
    const row = generations.get(node.id) ?? 0;
    rows.set(row, [...(rows.get(row) ?? []), node]);
  }

  const positioned = new Map<string, CanvasNode>();
  rows.forEach((rowNodes, row) => {
    rowNodes.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const startX = centerX - (rowNodes.length * columnWidth) / 2;
    rowNodes.forEach((node, idx) => {
      positioned.set(node.id, {
        ...node,
        x: Math.round(startX + idx * columnWidth),
        y: Math.round(topY + row * rowHeight),
      });
    });
  });

  return nodes.map((n) => positioned.get(n.id)!);
}
