'use client';

import { Download } from 'lucide-react';
import { DESKTOP_DOWNLOADS, RELEASES_URL } from '@/lib/downloads';
import { useIsDesktopApp } from '@/hooks/useIsDesktopApp';

// "Desktop app: Windows · macOS · Linux" links to the latest release's installers.
// Only on the web version; the desktop app doesn't offer itself.
export default function DesktopDownloads() {
  const isDesktopApp = useIsDesktopApp();
  if (isDesktopApp) return null;
  return (
    <nav aria-label="Download the desktop app" className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">
      <a href={RELEASES_URL} className="flex items-center gap-1 hover:text-gold transition-colors" title="All desktop downloads (GitHub release)">
        <Download size={12} aria-hidden /> Desktop app:
      </a>
      {DESKTOP_DOWNLOADS.map(({ platform, url, detail }, i) => (
        <span key={platform} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-slate-600">·</span>}
          <a
            href={url}
            className="font-semibold text-slate-300 hover:text-gold transition-colors"
            title={`Download Gaea Forge for ${detail}, from the latest GitHub release`}
            aria-label={`Download for ${platform}`}
          >
            {platform}
          </a>
        </span>
      ))}
    </nav>
  );
}
