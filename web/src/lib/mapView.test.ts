import { describe, expect, it } from 'vitest';
import { findArticleMaps, fitView, MAX_ZOOM, toImageFraction, toViewportPoint, zoomAt } from './mapView';

describe('fitView', () => {
  it('shrinks a large image to fit and centers it', () => {
    const view = fitView({ width: 1048, height: 548 }, { width: 2000, height: 1000 });
    expect(view.zoom).toBe(0.5);
    expect(view.pan).toEqual({ x: 24, y: 24 });
  });

  it('never enlarges a small image past 100%', () => {
    const view = fitView({ width: 1000, height: 800 }, { width: 200, height: 100 });
    expect(view.zoom).toBe(1);
    expect(view.pan).toEqual({ x: 400, y: 350 });
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const image = { width: 1000, height: 500 };
    const view = { zoom: 0.5, pan: { x: 10, y: 20 } };
    const anchor = { x: 300, y: 200 };
    const before = toImageFraction(anchor, view, image)!;
    const zoomed = zoomAt(view, 2, anchor);
    expect(zoomed.zoom).toBe(1);
    const after = toImageFraction(anchor, zoomed, image)!;
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps the zoom level', () => {
    expect(zoomAt({ zoom: 6, pan: { x: 0, y: 0 } }, 10, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
  });
});

describe('toImageFraction / toViewportPoint', () => {
  const image = { width: 400, height: 200 };
  const view = { zoom: 2, pan: { x: 50, y: 10 } };

  it('converts between viewport points and image fractions', () => {
    expect(toImageFraction({ x: 450, y: 210 }, view, image)).toEqual({ x: 0.5, y: 0.5 });
    expect(toViewportPoint({ x: 0.5, y: 0.5 }, view, image)).toEqual({ x: 450, y: 210 });
  });

  it('returns null outside the image', () => {
    expect(toImageFraction({ x: 40, y: 50 }, view, image)).toBeNull();
    expect(toImageFraction({ x: 900, y: 50 }, view, image)).toBeNull();
  });
});

describe('findArticleMaps', () => {
  it('lists map canvases with a pin for the article, ignoring other canvas types', () => {
    const pin = (articleId?: string) => ({ articleId });
    expect(
      findArticleMaps(
        [
          { id: 'm1', title: 'Realm', type: 'map', nodes: [pin(), pin('mira')] },
          { id: 'm2', title: 'City', type: 'map', nodes: [pin('other')] },
          { id: 'w', title: 'Web', type: 'world-web', nodes: [pin('mira')] },
        ],
        'mira'
      )
    ).toEqual([{ canvasId: 'm1', canvasTitle: 'Realm' }]);
  });
});
