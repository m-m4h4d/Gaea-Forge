# 🌍 Gaea Forge

> **Local-First, Open-Source World-Building & Lore Platform**

Gaea Forge is a privacy-first, offline-capable digital workbench designed for writers, game developers, world-builders, and narrative designers. Build rich interconnected worlds, manage dynamic entity codexes, map character lineages, and visualize relational webs—all stored locally on your machine.

---

## ✨ Features

- 🎭 **Role-Based Theming & Workspace System**: Tailored creative onboarding and themes for **Author's World & Character Bibles**, **Game Designer / Developer Idea Guides (GDD)**, **TTRPG Campaign Masters & Worldbuilders**, and **Personal Knowledge Bases**, with instant dynamic CSS theme switching and custom category hierarchies.
- 📑 **Intelligent Multi-Format Document Importer**: Import `.pdf`, `.docx`, `.doc`, `.md`, `.txt`, and `.json` documents. Automatically segments multi-topic documents into discrete articles (characters, nations, bestiary entries, artifacts, magic schools), extracts key-value attributes to the entity inspector, and provides an interactive review table before importing.
- 📖 **Rich Lore Codex & Editor**: Powered by TipTap WYSIWYG editor with support for custom entity properties (attributes, stats, traits), categories, and quick tag filters.
- 🌌 **3D Interactive Cosmos Canvas**: Real-time 3D WebGL universe powered by **Three.js** with 360° orbit rotation, category-themed glowing celestial bodies, luminous constellation beams, raycasting HUD, and cinematic galaxy auto-rotation.
- 🌳 **Family Tree & Dynasty Canvas**: Interactive visual hierarchy editor to map genealogical lineages, mentorships, alliances, and ancestral trees.
- 🕸️ **World Web Relationship Canvas**: Dual-mode (2D Map & 3D Cosmos) node graph for complex entity connections (alliances, rivalries, trade routes, political factions).
- ⚡ **Local-First Reactive Database**: Integrated with **RxDB** and **Dexie/IndexedDB**, giving zero-latency local queries and automatic state reactivity.
- 🖥️ **Native Desktop & Web Support**: Runs as a lightweight native desktop app powered by **Tauri v2 (Rust)** or as a responsive web app with **Next.js 16 & React 19**.
- 📦 **Data Portability**: Complete Export and Import functionality in JSON format for offline backups and sharing.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust + WebView2) |
| **Frontend Framework** | [Next.js 16](https://nextjs.org/) (App Router & Turbopack) |
| **3D Graphics Engine** | [Three.js](https://threejs.org/) (WebGL / OrbitControls) |
| **UI & Components** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| **Rich Text Editor** | [TipTap](https://tiptap.dev/) |
| **Local Database** | [RxDB](https://rxdb.info/) + [Dexie.js](https://dexie.org/) (IndexedDB) |
| **Language** | TypeScript, Rust |

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js**: `v18.0.0` or higher
2. **Rust & Cargo**: Required for running the native desktop app ([Install Rust](https://www.rust-lang.org/tools/install))
3. **C++ Build Tools**: Visual Studio C++ Build Tools (on Windows for Tauri)

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

> **Note**: On the first run, Cargo will download and compile the necessary crates for the Tauri backend. Subsequent launches will start almost instantly.

### 2. Run in Web Browser

To run purely in the browser using the Next.js development server:

```bash
npm run dev
```

Then navigate to [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Production Builds

### Build Desktop Installer / Executable

To package the native desktop application (`.msi`, `.exe`, etc.):

```bash
npm run tauri build
```

The output binaries will be located under `src-tauri/target/release/bundle/`.

### Build Static Web Distribution

To build the static web export:

```bash
npm run build
```

The static export files will be generated in `web/out/`.

---

## 📁 Project Structure

```text
Gaea-Forge/
├── package.json              # Monorepo root workspace configuration
├── README.md                 # Project documentation
├── src-tauri/                # Tauri v2 native desktop backend (Rust)
│   ├── Cargo.toml            # Rust dependencies
│   ├── tauri.conf.json       # Tauri window & bundle configuration
│   ├── capabilities/         # Security and window permissions
│   └── src/
│       ├── lib.rs            # Desktop window lifecycle & plugins
│       └── main.rs           # Rust entry point
└── web/                      # Next.js frontend application
    ├── package.json          # Web dependencies
    ├── next.config.ts        # Next.js configuration (static export)
    └── src/
        ├── app/              # App Router (main page, layout, globals)
        ├── components/       # UI Components (Editor, Canvases, Modals)
        │   ├── Editor.tsx
        │   ├── FamilyTreeCanvas.tsx
        │   ├── WorldWebCanvas.tsx
        │   ├── NewArticleModal.tsx
        │   ├── NewCanvasModal.tsx
        │   ├── NodeConnectModal.tsx
        │   └── ExportImportModal.tsx
        └── lib/              # Database (RxDB schemas, seed data)
            └── database.ts
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an Issue for bug reports and feature suggestions.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the terms described in the [LICENSE](LICENSE) file.
