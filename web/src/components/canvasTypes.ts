import { GitFork, Hourglass, LucideIcon, Map as MapIcon, Network } from 'lucide-react';
import { CanvasType } from '@/lib/database';

// Display details for each canvas type (sidebar, header, new-canvas modal)
export const CANVAS_TYPE_INFO: Record<
  CanvasType,
  { icon: LucideIcon; name: string; badge: string; description: string }
> = {
  'world-web': {
    icon: Network,
    name: 'World Web',
    badge: 'Web',
    description: 'Network graph connecting all articles, locations, factions & artifacts in your universe.',
  },
  'family-tree': {
    icon: GitFork,
    name: 'Family Tree & Lineage',
    badge: 'Tree',
    description: 'Hierarchical character tree for marriages, parentage, ancestors, and bloodlines.',
  },
  timeline: {
    icon: Hourglass,
    name: 'Timeline',
    badge: 'Time',
    description: 'Dated events grouped into eras, in your own calendar, linked to your articles.',
  },
  map: {
    icon: MapIcon,
    name: 'Map',
    badge: 'Map',
    description: 'Upload a map image and drop pins that link places to their articles.',
  },
};
