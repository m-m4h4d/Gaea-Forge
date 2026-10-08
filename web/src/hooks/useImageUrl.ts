'use client';

import { useEffect, useState } from 'react';
import { getCachedImage, isAssetRef, isImageDataUrl, loadImage } from '@/lib/assets';
import { getDatabase } from '@/lib/database';

// The displayable URL for an image field value: an asset reference (loaded from the
// database, then cached), or a legacy inline data URL. Undefined while loading or
// when there is no image.
export function useImageUrl(value: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ ref: string; url: string | undefined } | null>(null);
  const cached = isAssetRef(value) ? getCachedImage(value) : undefined;

  useEffect(() => {
    if (!isAssetRef(value) || getCachedImage(value)) return;
    let cancelled = false;
    getDatabase()
      .then((db) => loadImage(db, value))
      .then((url) => {
        if (!cancelled) setLoaded({ ref: value, url });
      })
      .catch((e) => console.error('Could not load image:', e));
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (isImageDataUrl(value)) return value;
  if (cached) return cached;
  return loaded && loaded.ref === value ? loaded.url : undefined;
}
