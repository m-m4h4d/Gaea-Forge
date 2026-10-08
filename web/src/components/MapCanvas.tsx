'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ImageUp, Map as MapIcon, MapPin, MapPinPlus, Maximize, Pencil, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { CanvasData, CanvasNode, LoreArticle } from '@/lib/database';
import { categoryColor } from '@/lib/categoryColors';
import { MAX_MAP_DIMENSION, readImageFile } from '@/lib/images';
import { fitView, MapView, Point, Size, toImageFraction, toViewportPoint, zoomAt } from '@/lib/mapView';
import { useImageUrl } from '@/hooks/useImageUrl';

interface MapCanvasProps {
  canvasData: CanvasData;
  onChange: (updated: CanvasData) => void;
  articles: LoreArticle[];
  onOpenArticle: (articleId: string) => void;
  // Stores the uploaded image and returns the value to save as mapImage
  storeImage: (dataUrl: string) => Promise<string>;
}

const createId = () => `pin-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
// Pointer travel (px) before a press on a pin counts as a drag instead of a click
const DRAG_THRESHOLD = 4;

type Drag =
  | { kind: 'pan'; start: Point; startPan: Point }
  | { kind: 'pin'; id: string; start: Point; moved: boolean };

type PinEditor = { pin?: CanvasNode; at: Point };

// A map image with pins linking places to articles. Pins are stored as canvas
// nodes whose x and y are fractions of the image size.
export default function MapCanvas({ canvasData, onChange, articles, onOpenArticle, storeImage }: MapCanvasProps) {
  const mapImageUrl = useImageUrl(canvasData.mapImage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [view, setView] = useState<MapView>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinEditor, setPinEditor] = useState<PinEditor | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Live position of a pin being dragged, before it is saved
  const [dragPosition, setDragPosition] = useState<Point | null>(null);

  const articleById = new Map(articles.map((a) => [a.id, a]));
  const pins = canvasData.nodes;
  const selectedPin = pins.find((p) => p.id === selectedPinId);

  const viewportPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !imageSize) return;
    setView(fitView({ width: el.clientWidth, height: el.clientHeight }, imageSize));
  }, [imageSize]);

  // Fit the image whenever a new one has loaded
  useEffect(() => {
    fit();
  }, [fit]);

  // Wheel zoom around the cursor (a native listener, so it can prevent page scroll)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setView((v) => zoomAt(v, e.deltaY < 0 ? 1.15 : 1 / 1.15, anchor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [canvasData.mapImage]);

  const zoomCentered = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    setView((v) => zoomAt(v, factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    try {
      const mapImage = await storeImage(await readImageFile(file, MAX_MAP_DIMENSION));
      setImageSize(null);
      onChange({ ...canvasData, mapImage });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Could not load that image.');
    }
  };

  const savePins = (nodes: CanvasNode[]) => onChange({ ...canvasData, nodes });

  // ---- Pointer handling: pan the map, place pins, drag pins ----

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !imageSize) return;
    const point = viewportPoint(e);
    if (isPlacing) {
      const at = toImageFraction(point, view, imageSize);
      if (at) setPinEditor({ at });
      setIsPlacing(false);
      return;
    }
    setSelectedPinId(null);
    setDrag({ kind: 'pan', start: point, startPan: view.pan });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePinPointerDown = (e: React.PointerEvent, pin: CanvasNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setDrag({ kind: 'pin', id: pin.id, start: viewportPoint(e), moved: false });
    viewportRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag || !imageSize) return;
    const point = viewportPoint(e);
    if (drag.kind === 'pan') {
      setView((v) => ({
        ...v,
        pan: { x: drag.startPan.x + point.x - drag.start.x, y: drag.startPan.y + point.y - drag.start.y },
      }));
      return;
    }
    const moved = drag.moved || Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > DRAG_THRESHOLD;
    if (!moved) return;
    if (!drag.moved) setDrag({ ...drag, moved: true });
    const at = toImageFraction(point, view, imageSize);
    if (at) setDragPosition(at);
  };

  const handlePointerUp = () => {
    if (drag?.kind === 'pin') {
      if (drag.moved && dragPosition) {
        savePins(pins.map((p) => (p.id === drag.id ? { ...p, x: dragPosition.x, y: dragPosition.y } : p)));
      } else if (!drag.moved) {
        setSelectedPinId((current) => (current === drag.id ? null : drag.id));
      }
    }
    setDrag(null);
    setDragPosition(null);
  };

  const savePin = (values: { articleId?: string; label: string }) => {
    if (!pinEditor) return;
    const article = values.articleId ? articleById.get(values.articleId) : undefined;
    const category = article?.category ?? 'Map Pin';
    if (pinEditor.pin) {
      const { id, x, y } = pinEditor.pin;
      const updated: CanvasNode = {
        id,
        x,
        y,
        label: values.label,
        category,
        ...(values.articleId && { articleId: values.articleId }),
      };
      savePins(pins.map((p) => (p.id === id ? updated : p)));
    } else {
      savePins([
        ...pins,
        {
          id: createId(),
          ...(values.articleId && { articleId: values.articleId }),
          label: values.label,
          category,
          x: pinEditor.at.x,
          y: pinEditor.at.y,
        },
      ]);
    }
    setPinEditor(null);
  };

  const deletePin = (pin: CanvasNode) => {
    if (!window.confirm(`Remove the pin "${pinLabel(pin)}"?`)) return;
    setSelectedPinId(null);
    savePins(pins.filter((p) => p.id !== pin.id));
  };

  // Linked pins follow their article's current title
  const pinLabel = (pin: CanvasNode) => (pin.articleId && articleById.get(pin.articleId)?.title) || pin.label;

  if (!canvasData.mapImage) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-parchment p-8 text-center gap-4">
        <MapIcon size={40} className="text-slate-500" aria-hidden />
        <div>
          <h2 className="text-base font-bold text-slate-200">Add a map image</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Upload a drawn or generated map, then drop pins on it that link places to their articles. Large images are
            scaled down to {MAX_MAP_DIMENSION}px.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg text-xs flex items-center gap-1.5"
        >
          <ImageUp size={14} aria-hidden /> Upload Map Image
        </button>
        {uploadError && <p role="alert" className="text-xs text-red-300">{uploadError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Map image file"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </div>
    );
  }

  const selectedPoint = selectedPin && imageSize ? toViewportPoint(selectedPin, view, imageSize) : null;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-parchment relative overflow-hidden select-none">
      {/* Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 sm:p-3 flex items-center gap-2 shrink-0 overflow-x-auto custom-scrollbar z-20">
        <button
          onClick={() => setIsPlacing((p) => !p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
            isPlacing
              ? 'bg-gold/20 text-gold ring-1 ring-inset ring-gold/50'
              : 'bg-gold hover:bg-gold-hover text-on-accent shadow-md shadow-gold/20'
          }`}
        >
          <MapPinPlus size={14} aria-hidden /> {isPlacing ? 'Click the map to place…' : 'Add Pin'}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 flex items-center gap-1.5 shrink-0"
          title="Replace the map image (pins keep their relative positions)"
        >
          <ImageUp size={13} aria-hidden /> Replace Image
        </button>
        <span className="text-xs text-slate-400 ml-1 shrink-0">
          <strong>{pins.length}</strong> pins
        </span>
        {uploadError && <span role="alert" className="text-xs text-red-300 shrink-0">{uploadError}</span>}
        <div className="ml-auto flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 shrink-0">
          <button onClick={() => zoomCentered(1 / 1.25)} className="p-1 text-slate-300 hover:text-gold" title="Zoom out">
            <ZoomOut size={14} aria-hidden />
          </button>
          <span className="text-xs font-mono px-1.5 text-gold w-12 text-center">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomCentered(1.25)} className="p-1 text-slate-300 hover:text-gold" title="Zoom in">
            <ZoomIn size={14} aria-hidden />
          </button>
          <button onClick={fit} className="p-1 text-slate-300 hover:text-gold" title="Fit map to view">
            <Maximize size={14} aria-hidden />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Map image file"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </div>

      {/* Map viewport */}
      <div
        ref={viewportRef}
        data-testid="map-viewport"
        className={`flex-1 relative overflow-hidden touch-none ${
          isPlacing ? 'cursor-crosshair' : drag?.kind === 'pan' ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImageUrl}
            alt={`Map: ${canvasData.title}`}
            draggable={false}
            onLoad={(e) => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            className="block max-w-none pointer-events-none shadow-2xl"
          />
          {imageSize &&
            pins.map((pin) => {
              const position = drag?.kind === 'pin' && drag.id === pin.id && dragPosition ? dragPosition : pin;
              const article = pin.articleId ? articleById.get(pin.articleId) : undefined;
              const color = categoryColor(article?.category ?? pin.category).css;
              return (
                <button
                  key={pin.id}
                  data-testid="map-pin"
                  aria-label={`Pin: ${pinLabel(pin)}`}
                  onPointerDown={(e) => handlePinPointerDown(e, pin)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedPinId(pin.id)}
                  className="absolute flex flex-col items-center cursor-pointer focus:outline-none group"
                  style={{
                    left: position.x * imageSize.width,
                    top: position.y * imageSize.height,
                    // Pins stay the same size on screen at any zoom
                    transform: `translate(-50%, -100%) scale(${1 / view.zoom})`,
                    transformOrigin: 'bottom center',
                  }}
                >
                  <span className="px-1.5 py-0.5 mb-0.5 rounded-md bg-slate-950/85 text-slate-100 text-[11px] font-semibold whitespace-nowrap shadow group-focus-visible:ring-2 ring-gold">
                    {pinLabel(pin)}
                  </span>
                  <MapPin
                    size={28}
                    strokeWidth={2.25}
                    style={{ color, fill: selectedPinId === pin.id ? color : 'var(--n-950)' }}
                    className="drop-shadow-md"
                    aria-hidden
                  />
                </button>
              );
            })}
        </div>

        {/* Popover for the selected pin, in screen space so it is not scaled */}
        {selectedPin && selectedPoint && (
          <div
            role="dialog"
            aria-label={`Pin ${pinLabel(selectedPin)}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-10 w-60 -translate-x-1/2 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 text-xs cursor-default"
            style={{ left: selectedPoint.x, top: selectedPoint.y }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-100 truncate">{pinLabel(selectedPin)}</div>
                <div className="text-[11px] text-slate-400">
                  {selectedPin.articleId && articleById.get(selectedPin.articleId)?.category}
                  {!selectedPin.articleId && 'Not linked to an article'}
                </div>
              </div>
              <button onClick={() => setSelectedPinId(null)} className="text-slate-400 hover:text-gold" title="Close pin">
                <X size={14} aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedPin.articleId && articleById.has(selectedPin.articleId) && (
                <button
                  onClick={() => onOpenArticle(selectedPin.articleId!)}
                  className="px-2 py-1 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg flex items-center gap-1"
                >
                  <BookOpen size={12} aria-hidden /> Open Article
                </button>
              )}
              <button
                onClick={() => {
                  setPinEditor({ pin: selectedPin, at: selectedPin });
                  setSelectedPinId(null);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
              >
                <Pencil size={12} aria-hidden /> Edit
              </button>
              <button
                onClick={() => deletePin(selectedPin)}
                className="px-2 py-1 bg-slate-800 hover:bg-red-900 text-red-400 hover:text-slate-50 rounded-lg flex items-center gap-1"
              >
                <Trash2 size={12} aria-hidden /> Remove
              </button>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-400 pointer-events-none">
          Drag to pan · Scroll to zoom · Drag pins to move them
        </div>
      </div>

      {pinEditor && (
        <PinModal
          pin={pinEditor.pin}
          articles={articles}
          onCancel={() => setPinEditor(null)}
          onSave={savePin}
        />
      )}
    </div>
  );
}

function PinModal({
  pin,
  articles,
  onCancel,
  onSave,
}: {
  pin?: CanvasNode;
  articles: LoreArticle[];
  onCancel: () => void;
  onSave: (values: { articleId?: string; label: string }) => void;
}) {
  const [articleId, setArticleId] = useState(pin?.articleId ?? '');
  const [label, setLabel] = useState(pin?.label ?? '');
  const [error, setError] = useState<string | null>(null);
  const sortedArticles = [...articles].sort((a, b) => a.title.localeCompare(b.title));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const article = articles.find((a) => a.id === articleId);
    const finalLabel = label.trim() || article?.title || '';
    if (!finalLabel) {
      setError('Link an article or give the pin a label.');
      return;
    }
    onSave({ articleId: articleId || undefined, label: finalLabel });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <form
        role="dialog"
        aria-label={pin ? 'Edit Pin' : 'Add Pin'}
        onSubmit={submit}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-parchment space-y-4 text-xs"
      >
        <h2 className="text-lg font-bold text-gold">{pin ? 'Edit Pin' : 'Add Pin'}</h2>
        <div>
          <label htmlFor="pin-article" className="block text-[11px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
            Linked article
          </label>
          <select
            id="pin-article"
            autoFocus
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold"
          >
            <option value="">None</option>
            {sortedArticles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.category})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pin-label" className="block text-[11px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
            Label {articleId && <span className="normal-case font-normal">(shown when not linked)</span>}
          </label>
          <input
            id="pin-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Emberfall Keep"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold"
          />
        </div>
        {error && (
          <p role="alert" className="text-red-300 bg-red-950/50 border border-red-800/80 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg">
            Save Pin
          </button>
        </div>
      </form>
    </div>
  );
}
