// Desktop app downloads, published by .github/workflows/release.yml. The release
// workflow uploads every installer under a fixed name as well, so these links always
// point at the newest release's files without naming a version.
export const RELEASES_URL = 'https://github.com/m-m4h4d/Gaea-Forge/releases/latest';

const download = (file: string) => `${RELEASES_URL}/download/${file}`;

export const WINDOWS_INSTALLER_URL = download('Gaea-Forge-Windows-x64-setup.exe');
export const MACOS_INSTALLER_URL = download('Gaea-Forge-macOS-universal.dmg');
// The AppImage runs on most distributions; the .deb is on the release page
export const LINUX_INSTALLER_URL = download('Gaea-Forge-Linux-x86_64.AppImage');

export const DESKTOP_DOWNLOADS = [
  { platform: 'Windows', url: WINDOWS_INSTALLER_URL, detail: 'Windows 10/11, 64-bit installer' },
  { platform: 'macOS', url: MACOS_INSTALLER_URL, detail: 'macOS, Apple Silicon and Intel (.dmg)' },
  { platform: 'Linux', url: LINUX_INSTALLER_URL, detail: 'Linux x86_64 (.AppImage)' },
] as const;
