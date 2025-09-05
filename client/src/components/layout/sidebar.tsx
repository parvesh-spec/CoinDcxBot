import { useLocation } from "wouter";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigation = [
    {
      name: "Trades",
      href: "/trades",
      icon: "fas fa-chart-line",
      current: location === "/" || location === "/trades",
    },
    {
      name: "Trade Message Template",
      href: "/templates",
      icon: "fas fa-edit",
      current: location === "/templates",
    },
  ];

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 md:hidden bg-gray-600 bg-opacity-75"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-robot text-2xl text-primary" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-foreground">CoinDCX Bot</h1>
                <p className="text-sm text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
                      item.current
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => onClose()}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <i className={cn(item.icon, "mr-3 flex-shrink-0 h-4 w-4")} />
                    {item.name}
                  </div>
                </Link>
              ))}
            </nav>

            {/* User section */}
            <div className="flex-shrink-0 flex border-t border-border p-4">
              <div className="flex-shrink-0 w-full group block">
                <div className="flex items-center">
                  <div className="inline-block h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <i className="fas fa-user text-primary-foreground text-sm" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-foreground" data-testid="text-username">
                      {(user as any)?.firstName || (user as any)?.username || (user as any)?.email || "Admin User"}
                    </p>
                    <button
                      onClick={() => window.location.href = '/api/logout'}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-logout"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
