import { Badge } from '@/components/ui/badge';

const ROLE_STYLES = {
  owner: 'bg-purple-50 text-purple-700',
  editor: 'bg-blue-50 text-blue-700',
  viewer: 'bg-gray-50 text-gray-600',
};

const ROLE_LABELS = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

export default function RoleBadge({ role, className = '' }) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.viewer;
  const label = ROLE_LABELS[role] || ROLE_LABELS.viewer;

  return (
    <Badge variant="outline" className={`${style} ${className}`.trim()}>
      {label}
    </Badge>
  );
}
