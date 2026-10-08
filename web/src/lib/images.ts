// Reading user images into data URLs (browser only)

export const MAX_MAP_DIMENSION = 4096;
// Cover art is shown at most a few hundred pixels wide
export const MAX_COVER_DIMENSION = 2048;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file is not an image this browser can open.'));
    img.src = src;
  });
}

// Read an image file as a data URL, downscaling it (as WebP) when its longest
// side exceeds maxDimension so huge maps don't bloat the database and backups.
export async function readImageFile(file: File, maxDimension: number): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file (PNG, JPEG, WebP, GIF or SVG).');
  }
  const original = await fileToDataUrl(file);
  const img = await loadImage(original);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= maxDimension) return original;

  const scale = maxDimension / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.9);
}
