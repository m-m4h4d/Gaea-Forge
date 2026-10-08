# Gaea Forge: Web App

The Gaea Forge user interface: a Next.js 16 app built as a static export (`out/`). It runs in the browser and is also the frontend of the Tauri desktop app in `../src-tauri`.

For what Gaea Forge is, how to install it and how to use it, see the [main README](../README.md). For architecture and conventions, see [`CLAUDE.md`](CLAUDE.md).

## Scripts

Run these from this folder. All of them except `test:watch` can also be run from the repository root, whose `package.json` forwards them to this workspace:

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Development server at [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Static export to `out/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output |
| `npm test` | Unit tests (Vitest), `npm run test:watch` to keep them running |
| `npm run test:e2e` | End-to-end tests (Playwright) against `out/`, so run `npm run build` first |

The first time you run the end-to-end tests, install the browser with `npx playwright install chromium`. Playwright serves `out/` itself with `e2e/serve.mjs`.

## Layout

```
src/
  app/          Main page (composition root), layout, global styles and theme tokens
  components/   UI: Sidebar, AppHeader, EntityInspector, Editor, the four canvas types, modals
  hooks/        useWorld (world data), useArticleSaver / useCanvasSaver (autosave and recovery),
                useColorMode, useStoredValue, useNotice
  lib/          Database schemas and migrations, backup/restore, document import, links,
                timeline and map logic, roles and theming helpers (unit tests sit next to each file)
public/         Static assets, including theme-init.js (applies the saved theme before first paint)
e2e/            Playwright tests and their static file server
```

All data is stored locally in IndexedDB through RxDB; there is no server or API.
