# Gaea Forge

Gaea Forge is a local-first world-building and lore app for writers, game designers and tabletop game masters. Users write lore articles (characters, places, factions, items), attach tags and key-value properties, and connect articles on canvases (a 2D/3D "world web" and family trees). All data stays on the user's device in IndexedDB. There is no server.

The app is a Next.js static export (`output: 'export'`) that runs in the browser or inside a Tauri v2 desktop shell (`../src-tauri`). Everything is client-side.

## Commands

Run from the repo root (npm workspaces) or from `web/`:

| Task | Command |
| :--- | :--- |
| Dev server (browser) | `npm run dev` |
| Desktop app (dev) | `npm run tauri dev` (root only) |
| Lint | `npm run lint` |
| Type-check | `npm run typecheck` |
| Unit tests (Vitest) | `npm test` |
| Static build to `web/out` | `npm run build` |
| End-to-end tests (Playwright) | `npm run test:e2e` (needs `npm run build` first) |

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## Layout

```
web/src/
  app/page.tsx            Composition root: selection, view mode, modals, confirm dialogs
  hooks/
    useWorld.ts           Database, articles, canvases, backup/import/restore operations
    useArticleSaver.ts    Debounced article writes + unload recovery journal
    useNotice.ts          Transient success/error toast
    useColorMode.ts       Light/dark/system color mode
    useStoredValue.ts     localStorage values read without hydration mismatches
  components/             UI (Sidebar, AppHeader, EntityInspector, Editor, canvases, modals)
    editor/               TipTap extensions: loreLink ([[ links between articles) + picker
  lib/
    database.ts           RxDB setup, schemas, types, seed data
    backup.ts             Backup format, parsing, snapshots, canvas pruning
    articles.ts           Pure article helpers (search, categories, factories)
    documentParser.ts     .pdf/.docx/.doc/.md/.txt/.json import and segmentation
    familyTreeLayout.ts   Family tree auto-arrange
    links.ts              Article links: extraction, backlinks, [[Title]] resolution
    roles.ts              Workspace roles: categories, wording, theme colors
    colorMode.ts          Color mode types and resolution
    categoryColors.ts     Category -> color (keyword based, works for every role)
web/e2e/                  Playwright tests against the static export
```

Keep `page.tsx` as wiring. Put data logic in `hooks/` or `lib/`, and anything that can be a pure function in `lib/` with a unit test next to it (`*.test.ts`).

## Data model and persistence

- RxDB with the Dexie (IndexedDB) storage, database `gaeafdb_v6`, collections `articles`, `canvases` and `snapshots` (`lib/database.ts`).
- **Never lose user data.** This is the main rule of the codebase:
  - Changing a schema means bumping its `version` and adding a `migrationStrategies` entry. Do not rename the database to start fresh.
  - Anything that replaces the world goes through `replaceWorldSafely` in `useWorld`, which saves a snapshot first.
  - RxDB bulk calls (`bulkInsert`, `bulkUpsert`, `bulkRemove`) report failures in their return value instead of throwing. Use the helpers in `lib/backup.ts`, which check it.
  - Report failures to the user with `notify`/`showNotice`, not only `console`.
- Article edits are debounced by `useArticleSaver`. Database change events are merged with unsaved local edits (`mergeWithPending`) so they never overwrite newer text. Deleting or overwriting an article must call `discard` for its id first, or a pending save will bring it back.
- `Editor.tsx` ignores `content` props that echo its own earlier output. Only genuinely external changes (imports, restores) reset the document.
- Deleting an article must also remove its canvas nodes and their connections (`pruneCanvasesToArticles`).
- Links between articles are stored in article HTML as `<a data-lore-link="articleId">label</a>` (`lib/links.ts`), keyed by id so renames never break them. Backlinks and world-web link lines are computed from content, not stored. Links to deleted articles are kept and shown as broken.
- The backup file format is defined in `lib/backup.ts` (`format: 'gaea-forge-backup'`, `version`). Bump `BACKUP_VERSION` for incompatible changes and keep reading older versions.

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
- New behavior needs a test: a Vitest unit test for logic in `lib/`, and a Playwright test in `e2e/` for user-visible flows that touch persistence.

@AGENTS.md
