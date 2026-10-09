# Gaea Forge

Gaea Forge is a local-first world-building and lore app for writers, game designers and tabletop game masters. Users write lore articles (characters, places, factions, items), attach tags and key-value properties, link articles to each other with `[[`, and arrange them on canvases: a 2D/3D "world web", family trees, timelines and maps. All data stays on the user's device in IndexedDB. There is no server.

The app is a Next.js static export (`output: 'export'`) that runs in the browser or inside a Tauri v2 desktop shell (`../src-tauri`). Everything is client-side.

## Commands

Run from the repo root (npm workspaces) or from `web/`:

| Task | Command |
| :--- | :--- |
| Dev server (browser) | `npm run dev` |
| Desktop app (dev) | `npm run tauri dev` (root only) |
| Desktop build check | `npm run tauri build -- --no-bundle` (root only; needs Rust and the Tauri system libraries) |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Unit tests (Vitest) | `npm test` |
| Static build to `web/out` | `npm run build` |
| End-to-end tests (Playwright) | `npm run test:e2e` (needs `npm run build` first) |

CI (`.github/workflows/ci.yml`) runs all of these on every pull request, plus a Linux desktop build and `cargo clippy -- -D warnings` in `src-tauri`.

## Layout

```
web/src/
  app/page.tsx            Composition root: selection, view mode, modals, delete/undo flows
  hooks/
    useWorld.ts           Database, articles, canvases, backup/import/restore operations
    useArticleSaver.ts    Debounced article writes + unload recovery journal
    useCanvasSaver.ts     Ordered canvas writes + unload recovery journal
    useNotice.ts          Transient success/error toast, optionally with an action (Undo)
    useFocusTrap.ts       Keeps keyboard focus inside a modal and restores it on close
    useColorMode.ts       Light/dark/system color mode
    useStoredValue.ts     localStorage values read without hydration mismatches
    useImageUrl.ts        Displayable URL for an image field (asset reference or legacy inline data)
    useArticleSearch.ts   Sidebar search results from a session-long, incrementally synced index
  components/             UI (Sidebar, AppHeader, EntityInspector, Editor, modals)
    dialogs/DialogProvider.tsx  Styled confirmation dialogs (useConfirm)
    dialogs/Modal.tsx     Shared modal shell: dialog role, Escape to close, focus trap
    QuickSwitcher.tsx     Ctrl/Cmd+K jump to an article or canvas
    SearchResults.tsx     Ranked sidebar search results with highlighted snippets
    WorldWebCanvas(3D).tsx, FamilyTreeCanvas.tsx, TimelineCanvas.tsx, MapCanvas.tsx
    canvasTypes.ts        Icon, name and description per canvas type
    editor/               TipTap extensions: loreLink ([[ links between articles) + picker
  lib/
    database.ts           RxDB setup, schemas, types, seed data
    backup.ts             Backup format, parsing, snapshots, canvas pruning
    articles.ts           Pure article helpers (tag filter, categories, factories)
    templates.ts          Per-category templates for new articles (built-in by keyword, user overrides on this device)
    search.ts             Ranked full-text search (MiniSearch) over plain text, snippets
    documentParser.ts     .pdf/.docx/.doc/.md/.txt/.json import and segmentation
    importRules.ts        Keyword rules that sort imported entries into categories (user-editable)
    familyTreeLayout.ts   Family tree auto-arrange
    links.ts              Article links: extraction, backlinks, [[Title]] resolution
    rename.ts             After a rename: link labels, heading and canvas labels still showing the old title
    roles.ts              Workspace roles: categories, wording, theme colors
    colorMode.ts          Color mode types and resolution
    categoryColors.ts     Category -> color (keyword based, works for every role)
    timeline.ts           Timeline ordering, eras, date labels, form validation
    calendar.ts           A timeline's own calendar: month names/lengths, year labels, era-relative dates
    mapView.ts            Map pan/zoom math and image <-> viewport coordinates
    images.ts             Reading (and downscaling) uploaded images
    quickSwitch.ts        Quick switcher ranking and recent items
    viewState.ts          The last view (open article/canvas, panels, folders, recents), saved per device
    threeDispose.ts       Freeing Three.js GPU resources (geometries, materials, textures)
    saveFile.ts           Saving files: native Save dialog in the desktop app, download in browsers
    markdownExport.ts     Markdown export: a .zip of files (front matter, relative links, images) or one document
    assets.ts             Image storage: the assets collection, asset references, moving/inlining/cleanup
web/public/theme-init.js  Applies the saved color mode and role colors before first paint
web/e2e/                  Playwright tests against the static export (fixtures.ts has shared helpers)
```

Keep `page.tsx` as wiring. Put data logic in `hooks/` or `lib/`, and anything that can be a pure function in `lib/` with a unit test next to it (`*.test.ts`).

## Data model and persistence

- RxDB with the Dexie (IndexedDB) storage, database `gaeafdb_v6`, collections `articles`, `canvases`, `snapshots` and `assets` (`lib/database.ts`).
- Images live once in `assets` (`lib/assets.ts`). `coverImage` and `mapImage` hold an `asset:<id>` reference; older data may still hold an inline `data:image/` URL, which `moveInlineImagesToAssets` converts when the database opens. Display images with `useImageUrl`, store new ones with `storeImage`, and never put image data into article or canvas records. Backups and snapshots inline the image data (`readWorld`), and `replaceWorld`/imports store it again. Unreferenced assets are deleted after a one-day grace period, because a recovery journal may still point at a fresh upload.
- **Never lose user data.** This is the main rule of the codebase:
  - Changing a schema means bumping its `version` and adding a `migrationStrategies` entry (see `canvasMigrationStrategies` in `database.ts`), plus a test in `database.test.ts` that opens data saved with the previous version. Do not rename the database to start fresh.
  - Anything that replaces the world goes through `replaceWorldSafely` in `useWorld`, which waits for pending writes and saves a snapshot first.
  - RxDB bulk calls (`bulkInsert`, `bulkUpsert`, `bulkRemove`) report failures in their return value instead of throwing. Use the helpers in `lib/backup.ts`, which check it.
  - Report failures to the user with `notify`/`showNotice`, not only `console`.
- Article edits are debounced by `useArticleSaver`. Database change events are merged with unsaved local edits (`mergeWithPending`) so they never overwrite newer text. Deleting or overwriting an article must call `discard` for its id first, or a pending save will bring it back.
- `Editor.tsx` ignores `content` props that echo its own earlier output. Only genuinely external changes (imports, restores) reset the document.
- Canvas types: `world-web`, `family-tree`, `timeline` (events and eras in `events`/`eras`; years are plain numbers in the world's calendar, months 1-based; an optional `calendar` (schema v2, `lib/calendar.ts`) only changes how dates are entered, checked and shown, so events never need converting; `parseCalendarDraft` refuses calendars that would leave an event's month or day out of range; backups keep it through `normalizeCalendar`) and `map` (`mapImage` data URL; pins are `nodes` with x/y as 0-1 fractions of the image).
- Canvas writes go through `useCanvasSaver`: queued so they reach the database in order, unconfirmed versions win over (possibly late) database change events, and a localStorage journal recovers edits made just before the page closes. Articles get the same protection from `useArticleSaver`. Keep canvas edits going through `updateCanvas` in `useWorld`.
- Deleting an article must also remove its canvas nodes, map pins and their connections, and unlink (not delete) its timeline events (`pruneCanvasesToArticles`). `deleteArticle` returns an undo function that restores the article and merges those links back into the current canvases (`restoreArticleLinks`), so edits made after the delete are kept.
- Markdown export (`lib/markdownExport.ts`) is loaded on demand from `useWorld.exportMarkdown`, so turndown and fflate stay out of the initial bundle. It reads the world through `readWorld` (images inline) like backups do. It is one-way: backups (`.json`) are the restore format.
- New articles take their category's template (`lib/templates.ts`): built-in ones are chosen by keywords in the category name, like category colors, so keep their vocabulary generic. Users can override a category's template; overrides live in localStorage (`gaea_category_templates`), like the import rules, so they are per device and not in backups. Create articles through `createArticleDraft` with `templateForCategory(...)` so every entry point (New Article, `[[` create, quick switcher) agrees.
- Search (`lib/search.ts`) indexes article text as plain text (`htmlToPlainText`), never raw HTML, so markup and link ids can't match. `ArticleSearchIndex.sync` re-indexes only articles whose object changed, which relies on edits replacing article objects rather than mutating them.
- The last view is saved in localStorage (`gaea_view_state`, `lib/viewState.ts`): it is per-device UI state, so it stays out of the database and backups. `page.tsx` restores it once `useWorld().isLoaded` is true, which waits for the database and for canvases recovered from the unload journal, and checks every saved id still exists (`resolveViewState`). It only starts saving after that restore, so the defaults never overwrite a saved view.
- Links between articles are stored in article HTML as `<a data-lore-link="articleId">label</a>` (`lib/links.ts`), keyed by id so renames never break them. Backlinks and world-web link lines are computed from content, not stored. Links to deleted articles are kept and shown as broken. Link labels are copies of text, though: after a rename (the inspector reports it when the title field loses focus), `page.tsx` offers to update labels, the article's heading and canvas node labels/event titles that are exactly the old title (`planRename`); custom wording is never touched.
- The backup file format is defined in `lib/backup.ts` (`format: 'gaea-forge-backup'`, `version`). Bump `BACKUP_VERSION` for incompatible changes and keep reading older versions.

## Importer

- Splitting uses document structure only: Markdown headings, numbered and Title Case heading lines, ALL CAPS or known group names as sections, and a heading directly followed by another heading as a section. `Key: Value` lines are properties and a lone `Label:` line is a subheading; neither starts a new entry.
- Categories come from `importRules.ts`: each role category gets keywords from its own name plus a generic genre vocabulary, scored by where they match (section > title > body). Users edit the keywords per role in the import dialog.
- Keep it world-agnostic: never add words from a particular setting to the parser or the default vocabulary. Test against the sample documents in `lib/__fixtures__/importSamples.ts`.

## Theming

- `<html data-theme="dark|light">` selects the color mode; `public/theme-init.js` sets it (and the role's colors) before first paint. `applyRoleTheme()` sets the `--role-*` variables.
- `globals.css` remaps Tailwind's **slate scale as the neutral scale** for both modes (inverted in light mode), plus the status colors (red, amber, emerald, purple, blue). So use `slate-*`, `gold` (accent), `on-accent` (text on accent fills), `background` and `parchment`. Do not hard-code hex colors, `text-white` or `text-slate-950` on accent fills; they break in light mode.
- SVG colors go through classes (`fill-gold`, `stroke-gold`, `fill-slate-900`) or `style={{ stroke: 'var(--accent)' }}`; presentation attributes do not resolve CSS variables.
- Solid `bg-gold` is for primary actions only. Active and selected states use tints (`bg-gold/15 text-gold`).
- Secondary text must meet WCAG AA (4.5:1) in both modes: `slate-500` and stronger are fine; `slate-600` is for icons and decoration only.
- Icons come from `lucide-react` (pinned); don't use emoji for UI chrome.
- The 3D cosmos is always dark (`data-theme="dark"` on its root).
- Values saved in localStorage that affect rendering must be read with `useStoredValue`, not in `useState` initializers, or hydration of the static export will mismatch.

## Conventions

- TypeScript strict mode; avoid `any`.
- Match the surrounding style: Tailwind utility classes, the `gold`/`parchment` theme tokens from `globals.css`, short comments that explain why.
- Next.js 16 has breaking changes from older versions; see `AGENTS.md`.
- Never use `window.confirm`, `alert` or `prompt` (the e2e fixtures fail on native dialogs). Ask with `useConfirm()` (`tone: 'danger'` for destructive actions). Prefer Undo over asking: deleting whole articles or canvases happens at once and shows a notice with an Undo action (`showNotice(kind, text, { label, onClick })`).
- Build new modals on `components/dialogs/Modal.tsx` so they get Escape and keyboard focus handling; pass `initialFocus` instead of using `autoFocus`.
- Three.js objects removed from the 3D scene must be freed with `removeAndDispose`/`disposeObject3D` (`lib/threeDispose.ts`); removing them from the scene alone leaks GPU memory. The scene setup effect must not depend on UI state, or the scene is rebuilt without its nodes. `e2e/cosmos.spec.ts` checks the live geometry count (`data-gpu-geometries`).
- Save files the user keeps with `saveFile` / `saveJsonFile` (`lib/saveFile.ts`), never `<a download>` directly: downloads are unreliable in the desktop webviews, so the desktop app calls the `save_file` Rust command (`src-tauri/src/lib.rs`), which takes the contents as base64 so binary files (zips) work. Keep `@tauri-apps/api` on the same major.minor version as the `tauri` crate; the Tauri CLI fails the build otherwise. `e2e/desktop.spec.ts` fakes the Tauri bridge to test the desktop path.
- New behavior needs a test: a Vitest unit test for logic in `lib/`, and a Playwright test in `e2e/` for user-visible flows that touch persistence.

@AGENTS.md
