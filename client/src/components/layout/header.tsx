import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: statusData } = useQuery({
    queryKey: ["/api/status"],
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  });

  const isActive = statusData?.monitor?.isRunning;

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden -ml-0.5 -mt-0.5 h-12 w-12"
            onClick={onMenuClick}
            data-testid="button-menu"
          >
            <span className="sr-only">Open sidebar</span>
            <i className="fas fa-bars h-6 w-6" />
          </Button>
          <h1 className="ml-4 text-2xl font-semibold text-foreground">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground" data-testid="text-bot-status">
              {isActive ? 'Bot Active' : 'Bot Inactive'}
            </span>
          </div>
          <Button variant="ghost" size="sm" data-testid="button-notifications">
            <i className="fas fa-bell h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
