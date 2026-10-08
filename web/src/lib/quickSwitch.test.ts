import { describe, expect, it } from 'vitest';
import { pushRecent, rankSwitchItems, scoreTitle, SwitchItem } from './quickSwitch';

const item = (id: string, title: string, kind: SwitchItem['kind'] = 'article'): SwitchItem => ({ kind, id, title, detail: '' });

describe('scoreTitle', () => {
  it.each([
    ['Queen Mira', 'queen mira', 0],
    ['Queen Mira', 'que', 1],
    ['Queen Mira', 'mir', 2],
    ['Queensguard', 'ensg', 3],
    ['Queen Mira', 'qmr', 4],
    ['Queen Mira', 'zzz', null],
    ['Queen Mira', '   ', 0],
  ] as const)('%s / %s -> %s', (title, query, expected) => {
    expect(scoreTitle(title, query)).toBe(expected);
  });
});

describe('rankSwitchItems', () => {
  const items = [item('a', 'Emberfall Keep'), item('b', 'Queen Mira'), item('c', 'Queensguard Barracks'), item('w', 'Master World Web', 'canvas')];

  it('orders by match quality, then recency, then shorter titles', () => {
    expect(rankSwitchItems(items, 'que', []).map((i) => i.id)).toEqual(['b', 'c']);
    expect(rankSwitchItems(items, 'que', ['c']).map((i) => i.id)).toEqual(['c', 'b']);
    expect(rankSwitchItems(items, 'keep', []).map((i) => i.id)).toEqual(['a']);
    expect(rankSwitchItems(items, 'web', []).map((i) => i.id)).toEqual(['w']);
  });

  it('shows recent items first when nothing is typed, then the rest alphabetically', () => {
    expect(rankSwitchItems(items, '', ['w', 'b']).map((i) => i.id)).toEqual(['w', 'b', 'a', 'c']);
  });

  it('respects the limit', () => {
    expect(rankSwitchItems(items, '', [], 2)).toHaveLength(2);
  });
});

describe('pushRecent', () => {
  it('moves an id to the front without duplicates and caps the list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});
