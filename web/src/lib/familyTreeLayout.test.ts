import { describe, expect, it } from 'vitest';
import { CanvasConnection, CanvasNode, RelationshipType } from './database';
import { computeGenerations, layoutFamilyTree } from './familyTreeLayout';

const node = (id: string): CanvasNode => ({ id, label: id, category: 'Characters', x: 0, y: 0 });
const link = (from: string, to: string, relationship: RelationshipType = 'parent-child'): CanvasConnection => ({
  id: `${from}-${to}`,
  fromNodeId: from,
  toNodeId: to,
  relationship,
});

describe('computeGenerations', () => {
  it('puts children one row below their parents', () => {
    const levels = computeGenerations(
      [node('grandma'), node('mom'), node('kid')],
      [link('grandma', 'mom'), link('mom', 'kid')]
    );
    expect(Object.fromEntries(levels)).toEqual({ grandma: 0, mom: 1, kid: 2 });
  });

  it('puts a married-in spouse on their partner’s row, below the partner’s parents', () => {
    // The spouse is listed first and has no parents of their own
    const levels = computeGenerations(
      [node('spouse'), node('dad'), node('son')],
      [link('dad', 'son'), link('spouse', 'son', 'spouse')]
    );
    expect(levels.get('dad')).toBe(0);
    expect(levels.get('son')).toBe(1);
    expect(levels.get('spouse')).toBe(1);
  });

  it('places a child below the deeper of two parents', () => {
    const levels = computeGenerations(
      [node('a'), node('b'), node('c'), node('child')],
      [link('a', 'b'), link('b', 'child'), link('c', 'child')]
    );
    expect(levels.get('child')).toBe(2);
  });

  it('terminates on parent-child cycles', () => {
    const levels = computeGenerations([node('x'), node('y')], [link('x', 'y'), link('y', 'x')]);
    expect(levels.size).toBe(2);
  });

  it('ignores connections to missing nodes and non-family relationships', () => {
    const levels = computeGenerations(
      [node('a'), node('b')],
      [link('ghost', 'a'), link('a', 'b', 'rival')]
    );
    expect(Object.fromEntries(levels)).toEqual({ a: 0, b: 0 });
  });
});

describe('layoutFamilyTree', () => {
  it('centers each row and spaces rows and columns evenly', () => {
    const nodes = [node('p'), node('c1'), node('c2')];
    const laid = layoutFamilyTree(nodes, [link('p', 'c1'), link('p', 'c2')], {
      rowHeight: 100,
      columnWidth: 50,
      centerX: 0,
      topY: 10,
    });
    expect(laid.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'p', x: -25, y: 10 },
      { id: 'c1', x: -50, y: 110 },
      { id: 'c2', x: 0, y: 110 },
    ]);
  });

  it('keeps spouses adjacent within a row', () => {
    const nodes = [node('a'), node('b'), node('aSpouse')];
    const laid = layoutFamilyTree(nodes, [link('a', 'aSpouse', 'spouse')]);
    const order = [...laid].sort((m, n) => m.x - n.x).map((n) => n.id);
    expect(Math.abs(order.indexOf('a') - order.indexOf('aSpouse'))).toBe(1);
  });

  it('returns new objects without mutating the input', () => {
    const nodes = [node('a')];
    const laid = layoutFamilyTree(nodes, []);
    expect(laid[0]).not.toBe(nodes[0]);
    expect(nodes[0].x).toBe(0);
  });
});
