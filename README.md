# 🌍 Gaea Forge

> **Local-First, Open-Source World-Building & Lore Platform**

Gaea Forge is a privacy-first, offline-capable workbench for writers, game designers, tabletop game masters and anyone building a fictional world. Write linked lore articles, map family trees and relationship webs, lay out history on timelines, pin places on your own maps, and keep it all on your machine. There is no account and no server: your world lives in a local database on your device.

---

## ✨ Features

### Writing & organizing

- 📖 **Lore Codex & Editor**: A rich-text editor (TipTap) with headings, lists, quotes and code, plus an inspector for each article's category, tags, custom key-value properties (stats, traits, status) and cover artwork.
- 🔗 **Linked Lore & Backlinks**: Type `[[` to link to another article, or create one on the spot. Links survive renames, every article lists what mentions it, and links to deleted articles are flagged.
- 🔎 **Search & Filters**: Search titles, text, tags and properties with ranked results (best matches first, with the matching passage highlighted). Partial words and small typos still match. Filter by tag, and pin important articles to the top of the sidebar.
- ⌨️ **Quick Switcher**: Press `Ctrl/Cmd+K` to jump to any article or canvas by typing part of its name, or create a new article from the same box.
- 🎭 **Workspace Roles**: Tailored setups for **Authors**, **Game Designers (GDD)**, **TTRPG Game Masters** and **Personal Knowledge Bases**, each with its own categories, wording and accent colors.

### Canvases

- 🕸️ **World Web**: A relationship graph of your articles with named connections (allies, rivals, mentors…). Articles that link to each other are joined automatically, and a **3D cosmos** view renders the web as an orbitable star field (Three.js).
- 🌳 **Family Trees**: Map parents, spouses, siblings and lineages, with one-click auto-arrangement into generations.
- ⏳ **Timelines**: History in your world's own calendar (negative years welcome), with events grouped into named eras, spans for wars and reigns, and links to articles.
- 🗺️ **Maps**: Upload a map image, pan and zoom it, and drop pins that link places to their articles. Every article shows which timelines and maps it appears on.

### Import, backup & safety

- 📑 **Document Import**: Import `.pdf`, `.docx`, `.doc`, `.md`, `.txt` and `.json`. Multi-topic documents are split into separate articles by their headings, `Key: Value` lines become properties, and `[[Title]]` references become links. Entries are sorted into your categories by keyword rules you can edit, and you review everything before it is saved. Imported HTML is sanitized.
- 📦 **Full Backups**: Export your whole world (articles, artwork, canvases and workspace role) to one `.json` file and restore it later, or merge just its articles.
- 🛟 **Safety Snapshots**: Before any import or restore that replaces your world, a snapshot is saved automatically; the last five can be restored in one click.
- ↩️ **Undo Deletes**: Deleting an article or canvas shows an **Undo** button for a few seconds; undoing an article also restores its places on canvases, maps and timelines.
- 💾 **Autosave with Recovery**: Changes save automatically (`Ctrl/Cmd+S` saves immediately), and edits made just before the app closes are recovered on the next start.

### Look & platform

- 🌓 **Light & Dark Themes**: Dark, light, or follow your system, with each role's accent colors in both modes and text that meets WCAG AA contrast.
- 🖥️ **Desktop & Web**: Runs as a native desktop app (Tauri v2) or in the browser (Next.js static export). Works fully offline.

---

## 🧭 Using Gaea Forge

1. **Pick a workspace role** on first launch (you can change it any time from the role button in the header). It sets your categories and colors, and can add a sample article.
2. **Create articles** with the **New** button at the bottom of the sidebar, or the **+** next to a category. Use the inspector on the right for tags, properties and artwork.
3. **Link your lore**: in the editor, type `[[` and pick an article. The inspector's **Mentioned In** list shows backlinks.
4. **Add canvases** with **+ New** under *World Canvases*: a World Web, Family Tree, Timeline or Map. Canvases are listed in the sidebar; switch between the editor and the active canvas with the tabs in the header.
5. **Import and back up** with the **Import** button at the top of the sidebar. The **Document Import** tab brings in files; **Backup & Restore** saves a full backup (the desktop app asks where to save it) and lists your safety snapshots.
6. **Jump around** with `Ctrl/Cmd+K`: type part of a name and press Enter.
7. **Switch themes** with the sun/moon button in the header.

---

## 🔒 Your Data

- Everything is stored locally in **IndexedDB** (via RxDB): in your browser profile when using the web version, or in the desktop app's own data folder. Nothing is uploaded anywhere.
- Clearing your browser's site data (or the desktop app's data) deletes your world, so **save a backup** from *Import → Backup & Restore* regularly.
- Images (cover art and maps) are stored once, separately from the text, and large ones are scaled down on upload (covers to 2048px, maps to 4096px on their longest side).
- Backups are plain JSON that include your images. The browser version downloads them; the desktop app opens a Save dialog so you choose where the file goes. Restoring one replaces your current world, after saving a safety snapshot of it first.
- When a new version changes how data is stored, existing data is migrated automatically on first launch.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust) |
| **Frontend** | [Next.js 16](https://nextjs.org/) (static export), [React 19](https://react.dev/) |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide](https://lucide.dev/) |
| **Rich Text Editor** | [TipTap](https://tiptap.dev/) |
| **Local Database** | [RxDB](https://rxdb.info/) + [Dexie.js](https://dexie.org/) (IndexedDB) |
| **3D Graphics** | [Three.js](https://threejs.org/) |
| **Document Import** | [PDF.js](https://mozilla.github.io/pdf.js/), [Mammoth](https://github.com/mwilliamson/mammoth.js), [DOMPurify](https://github.com/cure53/DOMPurify) |
| **Testing** | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) |
| **Language** | TypeScript, Rust |

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** `20.9` or newer (CI uses Node 22) and npm.
2. **For the desktop app only**: Rust and the platform dependencies Tauri needs (WebView2 and the C++ build tools on Windows, Xcode Command Line Tools on macOS, WebKitGTK on Linux). See the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).

### Installation

Clone the repository and install all dependencies:

```bash
git clone https://github.com/m-m4h4d/Gaea-Forge.git
cd Gaea-Forge
npm install
```

---

## 💻 Running the Application

### 1. Run as Native Desktop App (Tauri)

To launch the native desktop window with live reloading:

```bash
npm run tauri dev
```

> **Note**: On the first run, Cargo will download and compile the necessary crates for the Tauri backend. Subsequent launches start much faster.

### 2. Run in Web Browser

To run in the browser using the Next.js development server:

```bash
npm run dev
```

Then navigate to [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Production Builds

### Build Desktop Installer / Executable

To package the native desktop application (`.msi`, `.exe`, `.dmg`, `.AppImage`, etc., depending on your platform):

```bash
npm run tauri build
```

The output binaries will be located under `src-tauri/target/release/bundle/`.

### Build Static Web Distribution

To build the static web export:

```bash
npm run build
```

The static files are generated in `web/out/` and can be served by any static file host.

---

## 🧪 Testing

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Unit tests (Vitest)
npm run build       # Static export to web/out
npm run test:e2e    # End-to-end tests (Playwright, runs against web/out)
```

The first time you run the end-to-end tests, install the browser with `npx playwright install chromium` from `web/`. CI runs all of the above on every pull request and on pushes to `master`, and also builds the desktop app on Linux (`npm run tauri build -- --no-bundle`) and runs Clippy on the Rust code.

---

## 📁 Project Structure

```text
Gaea-Forge/
├── package.json              # Monorepo root (npm workspaces) and scripts
├── .github/workflows/ci.yml  # Lint, type-check, unit, build and e2e checks
├── src-tauri/                # Tauri v2 native desktop shell (Rust)
│   ├── Cargo.toml            # Rust dependencies
│   ├── tauri.conf.json       # Window, bundle and Content Security Policy
│   ├── capabilities/         # Window permissions
│   └── src/                  # Rust entry point and window setup
└── web/                      # Next.js frontend application
    ├── CLAUDE.md             # Architecture notes and conventions for contributors
    ├── package.json          # Web dependencies and scripts
    ├── next.config.ts        # Next.js configuration (static export)
    ├── public/               # Static assets, incl. theme-init.js (applies the theme before first paint)
    ├── e2e/                  # Playwright end-to-end tests
    └── src/
        ├── app/              # Main page, layout and global styles/theme tokens
        ├── components/       # UI: sidebar, header, inspector, editor, canvases, modals
        ├── hooks/            # World data, autosave (articles and canvases), theme, notices, focus trap
        └── lib/              # Database schemas, backup/restore, import, links, timeline and map logic (+ unit tests)
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open an Issue for bug reports and feature suggestions, or submit a Pull Request.

1. Fork the project and create a feature branch (`git checkout -b feature/amazing-feature`).
2. Read [`web/CLAUDE.md`](web/CLAUDE.md) for the architecture and conventions, especially the rules that protect user data (schema migrations, safety snapshots) and the theming tokens.
3. Add tests for new behavior: Vitest unit tests next to logic in `web/src/lib/`, and Playwright tests in `web/e2e/` for user-facing flows.
4. Run the checks in [Testing](#-testing) before opening your Pull Request.

---

## 📄 License

Gaea Forge is licensed under the [Apache License 2.0](LICENSE).
