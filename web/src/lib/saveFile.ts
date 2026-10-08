// Saving a file the user keeps (backups). Browsers get a normal download. The desktop
// app (Tauri) asks Rust to show a native Save dialog and write the file, because
// <a download> is unreliable inside the desktop webviews (WKWebView, WebKitGTK).
import { invoke, isTauri } from '@tauri-apps/api/core';

export type SaveResult =
  | { status: 'saved'; path: string } // desktop: written where the user chose
  | { status: 'cancelled' } // desktop: the user closed the dialog
  | { status: 'downloaded' }; // browser: handed to the browser's downloads

// Name of the Rust command in src-tauri/src/lib.rs
export const SAVE_COMMAND = 'save_json_file';

export async function saveJsonFile(fileName: string, contents: string): Promise<SaveResult> {
  if (isTauri()) {
    const path = await invoke<string | null>(SAVE_COMMAND, { defaultName: fileName, contents });
    return path ? { status: 'saved', path } : { status: 'cancelled' };
  }

  const blob = new Blob([contents], { type: 'application/json' });
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
