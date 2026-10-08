import { BookOpen, Dices, Gamepad2, NotebookPen, LucideProps } from 'lucide-react';
import { RoleId } from '@/lib/roles';

const ICONS: Record<RoleId, React.ComponentType<LucideProps>> = {
  'author-bible': BookOpen,
  'game-dev': Gamepad2,
  'ttrpg-dm': Dices,
  'personal-notes': NotebookPen,
};

export default function RoleIcon({ roleId, ...props }: { roleId: RoleId } & LucideProps) {
  const Icon = ICONS[roleId] ?? BookOpen;
  return <Icon aria-hidden {...props} />;
}
