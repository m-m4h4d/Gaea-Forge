// Pan/zoom math for map canvases. The image is drawn at its natural size inside a
// layer transformed by translate(pan) scale(zoom), with the origin at top-left.

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type MapView = { zoom: number; pan: Point };

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// Fit the whole image in the viewport with a small margin, never enlarging past 100%
export function fitView(viewport: Size, image: Size, margin = 24): MapView {
  if (image.width <= 0 || image.height <= 0) return { zoom: 1, pan: { x: 0, y: 0 } };
  const zoom = clampZoom(
    Math.min(1, (viewport.width - margin * 2) / image.width, (viewport.height - margin * 2) / image.height)
  );
  return {
    zoom,
    pan: { x: (viewport.width - image.width * zoom) / 2, y: (viewport.height - image.height * zoom) / 2 },
  };
}

// Zoom by `factor` keeping the image point under `anchor` (viewport coordinates) still
export function zoomAt(view: MapView, factor: number, anchor: Point): MapView {
  const zoom = clampZoom(view.zoom * factor);
  const ratio = zoom / view.zoom;
  return {
    zoom,
    pan: { x: anchor.x - (anchor.x - view.pan.x) * ratio, y: anchor.y - (anchor.y - view.pan.y) * ratio },
  };
}

// Viewport point -> position on the image as fractions (0-1); null when outside the image
export function toImageFraction(point: Point, view: MapView, image: Size): Point | null {
  const x = (point.x - view.pan.x) / view.zoom / image.width;
  const y = (point.y - view.pan.y) / view.zoom / image.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

// Image fractions -> viewport point
export function toViewportPoint(fraction: Point, view: MapView, image: Size): Point {
  return {
    x: view.pan.x + fraction.x * image.width * view.zoom,
    y: view.pan.y + fraction.y * image.height * view.zoom,
  };
}

// Map canvases with a pin linked to the article
export function findArticleMaps(
  canvases: { id: string; title: string; type: string; nodes: { articleId?: string }[] }[],
  articleId: string
): { canvasId: string; canvasTitle: string }[] {
  return canvases
    .filter((c) => c.type === 'map' && c.nodes.some((n) => n.articleId === articleId))
    .map((c) => ({ canvasId: c.id, canvasTitle: c.title }));
}
