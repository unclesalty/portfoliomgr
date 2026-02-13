import { usePortfolio } from '@/contexts/PortfolioContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LayoutDashboard } from 'lucide-react';
import RoleBadge from '@/components/RoleBadge';

export default function PortfolioSelector() {
  const { portfolios, currentPortfolio, accessRole, switchPortfolio, exitPortfolio } = usePortfolio();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-white hover:text-purple-200 max-w-[200px]">
          <span className="truncate">{currentPortfolio?.name || 'Select Portfolio'}</span>
          {currentPortfolio && <RoleBadge role={accessRole} className="ml-2 text-xs" />}
          <ChevronDown className="h-4 w-4 ml-1 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Portfolios</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {portfolios.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => switchPortfolio(p.id)}
            className={currentPortfolio?.id === p.id ? 'bg-purple-50' : ''}
          >
            <span className="truncate flex-1">{p.name}</span>
            <RoleBadge role={p.role} className="ml-2 text-xs" />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exitPortfolio}>
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Back to Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
