// Saving a file the user keeps (backups, exports). Browsers get a normal download.
// The desktop app (Tauri) asks Rust to show a native Save dialog and write the file,
// because <a download> is unreliable inside the desktop webviews (WKWebView, WebKitGTK).
import { invoke, isTauri } from '@tauri-apps/api/core';

export type SaveResult =
  | { status: 'saved'; path: string } // desktop: written where the user chose
  | { status: 'cancelled' } // desktop: the user closed the dialog
  | { status: 'downloaded' }; // browser: handed to the browser's downloads

// What the Save dialog filters on, and the browser download's type
export type FileKind = { label: string; extensions: string[]; mime: string };
export const JSON_FILE: FileKind = { label: 'JSON backup', extensions: ['json'], mime: 'application/json' };
export const MARKDOWN_FILE: FileKind = { label: 'Markdown', extensions: ['md'], mime: 'text/markdown' };
export const ZIP_FILE: FileKind = { label: 'Zip archive', extensions: ['zip'], mime: 'application/zip' };

// Name of the Rust command in src-tauri/src/lib.rs
export const SAVE_COMMAND = 'save_file';

// The IPC bridge carries JSON, so binary contents travel as base64
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function saveFile(fileName: string, data: string | Uint8Array, kind: FileKind): Promise<SaveResult> {
  if (isTauri()) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const path = await invoke<string | null>(SAVE_COMMAND, {
      defaultName: fileName,
      contentsBase64: bytesToBase64(bytes),
      filterName: kind.label,
      extensions: kind.extensions,
    });
    return path ? { status: 'saved', path } : { status: 'cancelled' };
  }

  const blob = new Blob([data as BlobPart], { type: kind.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { status: 'downloaded' };
}

export const saveJsonFile = (fileName: string, contents: string) => saveFile(fileName, contents, JSON_FILE);
