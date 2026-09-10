// Role-based theming and workspace configuration system for Gaea-Forge

export type RoleId = 'author-bible' | 'game-dev' | 'ttrpg-dm' | 'personal-notes';

export interface RoleTheme {
  primary: string; // Hex for accent (e.g. gold, cyan, emerald, azure)
  primaryHover: string;
  primaryLight: string;
  bgDark: string; // Main background
  surfaceDark: string; // Sidebar/header
  cardDark: string; // Cards/inputs
  border: string; // Border color
  textMain: string;
  textMuted: string;
  accentGlow: string;
}

export interface RoleConfig {
  id: RoleId;
  title: string;
  shortName: string;
  badge: string;
  tagline: string;
  description: string;
  icon: string;
  theme: RoleTheme;
  categories: string[];
  terminology: {
    entityNoun: string; // e.g. "Lore Entity", "Game Element", "Campaign Record", "Note"
    workspaceTitle: string;
    newArticleButton: string;
    codexTitle: string;
    canvasWebTitle: string;
    canvasTreeTitle: string;
  };
  sampleArticle: {
    title: string;
    category: string;
    tags: string[];
    properties: { key: string; value: string }[];
    content: string;
  };
}

export const ROLES: Record<RoleId, RoleConfig> = {
  'author-bible': {
    id: 'author-bible',
    title: "Author's World & Character Bible",
    shortName: 'Author Bible',
    badge: 'Novelist & Lore',
    tagline: 'Craft rich lore, character bibles, kingdoms, and magic systems for fantasy and sci-fi books.',
    description: 'Designed for novelists and storytellers. Focuses on character arcs, lineage trees, realm geography, factions, and world mythology.',
    icon: '📖',
    theme: {
      primary: '#fbbf24', // Amber/Gold
      primaryHover: '#f59e0b',
      primaryLight: 'rgba(251, 191, 36, 0.15)',
      bgDark: '#0b0f19',
      surfaceDark: '#0f172a',
      cardDark: '#070b14',
      border: '#1e293b',
      textMain: '#fef3c7', // Parchment
      textMuted: '#94a3b8',
      accentGlow: 'rgba(251, 191, 36, 0.25)',
    },
    categories: [
      'Characters & Cast',
      'Realms & Locations',
      'Kingdoms & Factions',
      'Magic & Relics',
      'Bestiary & Species',
      'Plot & Chapters',
    ],
    terminology: {
      entityNoun: 'Lore Entity',
      workspaceTitle: "Author's World Bible",
      newArticleButton: '+ New Lore Entity',
      codexTitle: 'World Lore Codex',
      canvasWebTitle: 'Master World Web',
      canvasTreeTitle: 'Character Lineage Tree',
    },
    sampleArticle: {
      title: "Welcome to Your Author's World Bible",
      category: 'Plot & Chapters',
      tags: ['guide', 'worldbuilding', 'getting-started'],
      properties: [
        { key: 'Focus', value: 'Novel Worldbuilding' },
        { key: 'Status', value: 'Active Writing' },
        { key: 'Setting Vibe', value: 'High Fantasy & Magic' },
      ],
      content: `
        <h1>Welcome to Your Author's World Bible</h1>
        <p>This workspace is customized for authors, novelists, and storytellers building deep fictional universes.</p>
        <h2>Your Storytelling Arsenal</h2>
        <ul>
          <li><strong>Characters & Cast:</strong> Build multi-dimensional character sheets with personal arcs, motivations, and powers.</li>
          <li><strong>Realms & Kingdoms:</strong> Chart political dynasties, sovereign territories, capitals, and biomes.</li>
          <li><strong>Magic Systems & Relics:</strong> Document sacred artifacts, ancient schools, and spellcasting rules.</li>
          <li><strong>Lineage & World Canvases:</strong> Map family trees and visualize relational webs connecting your characters.</li>
          <li><strong>Intelligent Document Import:</strong> Import existing .pdf, .docx, .md, and .txt manuscripts or notes to auto-generate organized codex entries!</li>
        </ul>
      `,
    },
  },

  'game-dev': {
    id: 'game-dev',
    title: "Game Designer / Developer's Idea Guide (GDD)",
    shortName: 'Game Dev GDD',
    badge: 'Game Design & Specs',
    tagline: 'Structure game design documents, combat mechanics, entities, levels, and item databases.',
    description: 'Tailored for indie developers and game designers to draft game mechanics, player abilities, enemy specs, and level layouts.',
    icon: '🎮',
    theme: {
      primary: '#06b6d4', // Electric Cyan
      primaryHover: '#0891b2',
      primaryLight: 'rgba(6, 182, 212, 0.15)',
      bgDark: '#080c14',
      surfaceDark: '#0d131f',
      cardDark: '#05080e',
      border: '#1a2436',
      textMain: '#e0f2fe',
      textMuted: '#7dd3fc',
      accentGlow: 'rgba(6, 182, 212, 0.3)',
    },
    categories: [
      'Game Systems & Mechanics',
      'Characters & NPCs',
      'Factions & Guilds',
      'Levels & Biomes',
      'Weapons & Items',
      'Quests & Dialogue',
    ],
    terminology: {
      entityNoun: 'Design Element',
      workspaceTitle: 'Game Design Document (GDD)',
      newArticleButton: '+ New Game Element',
      codexTitle: 'Game Systems Codex',
      canvasWebTitle: 'System Interaction Graph',
      canvasTreeTitle: 'Progression & Quest Tree',
    },
    sampleArticle: {
      title: 'Game Project Core Vision (GDD)',
      category: 'Game Systems & Mechanics',
      tags: ['gdd', 'core-loop', 'spec'],
      properties: [
        { key: 'Target Genre', value: 'Action RPG / Sandbox' },
        { key: 'Engine', value: 'Custom / Unity / Unreal' },
        { key: 'Production Phase', value: 'Pre-Production' },
      ],
      content: `
        <h1>Game Design Document & Idea Guide</h1>
        <p>Welcome to your digital Game Design Document (GDD). Organize complex game mechanics, entity rosters, level geometry, and item economies.</p>
        <h2>Development Features</h2>
        <ul>
          <li><strong>Combat & Systems:</strong> Define player stat scaling, elemental damage matrices, and cooldown loops.</li>
          <li><strong>Entity & NPC Database:</strong> Create stat blocks for heroes, bosses, friendly factions, and enemy AI types.</li>
          <li><strong>Interactive Tech Web:</strong> Use the 2D/3D Canvas to map out skill trees, tech progression, and quest prerequisites.</li>
          <li><strong>Document Importer:</strong> Import draft design specs (.docx, .pdf, .md) to instantly extract mechanics and entity profiles.</li>
        </ul>
      `,
    },
  },

  'ttrpg-dm': {
    id: 'ttrpg-dm',
    title: 'TTRPG Campaign Master & Worldbuilder',
    shortName: 'TTRPG Master',
    badge: 'Tabletop & Encounters',
    tagline: 'Prepare encounters, campaign arcs, dungeon maps, homebrew items, and faction intrigue.',
    description: 'Crafted for Dungeon Masters and game leaders running D&D, Pathfinder, or custom TTRPG campaigns.',
    icon: '🐉',
    theme: {
      primary: '#10b981', // Radiant Emerald
      primaryHover: '#059669',
      primaryLight: 'rgba(16, 185, 129, 0.15)',
      bgDark: '#07120e',
      surfaceDark: '#0c1d17',
      cardDark: '#040b08',
      border: '#163327',
      textMain: '#ecfdf5',
      textMuted: '#6ee7b7',
      accentGlow: 'rgba(16, 185, 129, 0.25)',
    },
    categories: [
      'Player Characters & NPCs',
      'Locations & Dungeons',
      'Factions & Organizations',
      'Monsters & Bestiary',
      'Spells & Magic Items',
      'Session Logs & Encounters',
    ],
    terminology: {
      entityNoun: 'Campaign Record',
      workspaceTitle: 'DM Campaign Codex',
      newArticleButton: '+ New Campaign Record',
      codexTitle: 'Campaign Codex',
      canvasWebTitle: 'Faction & NPC Intrigue Web',
      canvasTreeTitle: 'Lineage & Loyalty Tree',
    },
    sampleArticle: {
      title: 'Campaign Primer: Realm of Gaiathos',
      category: 'Session Logs & Encounters',
      tags: ['campaign-overview', 'session-0', 'ttrpg'],
      properties: [
        { key: 'System', value: 'D&D 5e / Homebrew' },
        { key: 'Party Level', value: '3' },
        { key: 'Current Arc', value: 'The Schism Awakening' },
      ],
      content: `
        <h1>Campaign Primer: Session 0 & Master Log</h1>
        <p>Prepare your tabletop sessions with zero friction. Keep track of party choices, NPC allegiances, and active dungeon encounters.</p>
        <h2>DM Command Center</h2>
        <ul>
          <li><strong>Party & NPC Roster:</strong> Track character stats, loyalty scores, secrets, and quest lines.</li>
          <li><strong>Bestiary & Monsters:</strong> Organize stat blocks, legendary actions, and creature vulnerabilities.</li>
          <li><strong>Interactive World Web:</strong> Graph NPC connections, faction rivalries, and trade routes in 2D and 3D.</li>
          <li><strong>Instant Document Import:</strong> Upload PDF campaign modules and monster handbooks to create instant ready-to-run encounter articles.</li>
        </ul>
      `,
    },
  },

  'personal-notes': {
    id: 'personal-notes',
    title: 'Personal Knowledge Base & Notes App',
    shortName: 'Notes & Journal',
    badge: 'Knowledge & Ideas',
    tagline: 'A clean, fast, local-first second brain for daily notes, concepts, journals, and research.',
    description: 'Perfect for researchers, students, and thinkers who desire a markdown-powered local second brain with 3D knowledge graphing.',
    icon: '📝',
    theme: {
      primary: '#3b82f6', // Sleek Azure Blue
      primaryHover: '#2563eb',
      primaryLight: 'rgba(59, 130, 246, 0.15)',
      bgDark: '#080c16',
      surfaceDark: '#0f172a',
      cardDark: '#050810',
      border: '#1e293b',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      accentGlow: 'rgba(59, 130, 246, 0.25)',
    },
    categories: [
      'Daily Notes & Journal',
      'Projects & Roadmaps',
      'People & Contacts',
      'Concepts & Ideas',
      'Research & Reference',
      'Archive & Snippets',
    ],
    terminology: {
      entityNoun: 'Note',
      workspaceTitle: 'Personal Knowledge Base',
      newArticleButton: '+ New Note',
      codexTitle: 'Personal Notes Codex',
      canvasWebTitle: 'Concept Mind Web',
      canvasTreeTitle: 'Topic Hierarchy Tree',
    },
    sampleArticle: {
      title: 'Welcome to Your Knowledge Base',
      category: 'Daily Notes & Journal',
      tags: ['notes', 'second-brain', 'pkm'],
      properties: [
        { key: 'Workspace', value: 'Personal Vault' },
        { key: 'Storage', value: 'Local IndexedDB' },
        { key: 'Privacy', value: '100% Offline' },
      ],
      content: `
        <h1>Personal Knowledge Base & Second Brain</h1>
        <p>A clutter-free, privacy-preserving workspace for your thoughts, research, projects, and personal notes.</p>
        <h2>Core Capabilities</h2>
        <ul>
          <li><strong>Daily Notes & Research:</strong> Rapidly jot down ideas, book summaries, and project roadmaps.</li>
          <li><strong>Interactive Mind Graph:</strong> Visualize how concepts, authors, and projects interconnect in 2D or a 3D cosmos view.</li>
          <li><strong>Custom Metadata:</strong> Add tags, priorities, deadlines, and status attributes to any note.</li>
          <li><strong>Multi-Format Import:</strong> Import .md files, PDF articles, and Word documents to consolidate all your knowledge in one place.</li>
        </ul>
      `,
    },
  },
};

export const DEFAULT_ROLE_ID: RoleId = 'author-bible';

// Helper to inject role CSS variables into DOM
export function applyRoleTheme(roleId: RoleId) {
  if (typeof window === 'undefined') return;
  const role = ROLES[roleId] || ROLES[DEFAULT_ROLE_ID];
  const root = document.documentElement;

  root.style.setProperty('--theme-accent', role.theme.primary);
  root.style.setProperty('--theme-accent-hover', role.theme.primaryHover);
  root.style.setProperty('--theme-accent-light', role.theme.primaryLight);
  root.style.setProperty('--theme-accent-glow', role.theme.accentGlow);
  root.style.setProperty('--theme-bg', role.theme.bgDark);
  root.style.setProperty('--theme-surface', role.theme.surfaceDark);
  root.style.setProperty('--theme-card', role.theme.cardDark);
  root.style.setProperty('--theme-border', role.theme.border);
  root.style.setProperty('--theme-text', role.theme.textMain);
  root.style.setProperty('--theme-text-muted', role.theme.textMuted);

  // Also update standard tailwind color vars
  root.style.setProperty('--gold', role.theme.primary);
  root.style.setProperty('--color-gold', role.theme.primary);
  root.style.setProperty('--color-gold-hover', role.theme.primaryHover);

  try {
    localStorage.setItem('gaea_user_role', roleId);
  } catch {
    // ignore
  }
}

// Helper to get active role from localStorage
export function getSavedRole(): RoleId {
  if (typeof window === 'undefined') return DEFAULT_ROLE_ID;
  try {
    const saved = localStorage.getItem('gaea_user_role') as RoleId;
    if (saved && ROLES[saved]) {
      return saved;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ROLE_ID;
}

// Check if user has completed first-time onboarding
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem('gaea_onboarding_completed') === 'true';
  } catch {
    return true;
  }
}

// Set onboarding completed
export function setOnboardingCompleted(completed: boolean = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('gaea_onboarding_completed', completed ? 'true' : 'false');
  } catch {
    // ignore
  }
}

// Maps semantic bucket (character, location, faction, magic, bestiary, notes) to the role's actual category name
export function mapSemanticToRoleCategory(
  semantic: 'characters' | 'locations' | 'factions' | 'magic' | 'artifacts' | 'bestiary' | 'notes',
  roleId: RoleId
): string {
  const categories = ROLES[roleId]?.categories || ROLES[DEFAULT_ROLE_ID].categories;

  switch (semantic) {
    case 'characters':
      return categories.find((c) => /character|people|cast|npc/i.test(c)) || categories[0];
    case 'locations':
      return categories.find((c) => /location|realm|level|dungeon|place|biome/i.test(c)) || categories[1] || categories[0];
    case 'factions':
      return categories.find((c) => /faction|kingdom|guild|organization|project/i.test(c)) || categories[2] || categories[0];
    case 'magic':
      return categories.find((c) => /magic|system|mechanic|spell|concept/i.test(c)) || categories[3] || categories[0];
    case 'artifacts':
      return categories.find((c) => /relic|artifact|weapon|item|gear/i.test(c)) || categories[3] || categories[0];
    case 'bestiary':
      return categories.find((c) => /bestiary|monster|species/i.test(c)) || categories.find((c) => /character|npc/i.test(c)) || categories[0];
    case 'notes':
    default:
      return categories.find((c) => /note|plot|session|journal|archive|chapter/i.test(c)) || categories[categories.length - 1];
  }
}
