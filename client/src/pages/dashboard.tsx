import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import TradesPage from "./trades";
import TemplatesPage from "./templates";
import ChannelsPage from "./channels";
import AutomationPage from "./automation";

export default function Dashboard() {
  const [location] = useLocation();

  const renderContent = () => {
    switch (location) {
      case "/copy-trading/users":
        return <div className="p-6"><h1 className="text-2xl font-bold">Copy Trading Users</h1><p className="text-muted-foreground">Manage copy trading user accounts and settings.</p></div>;
      case "/copy-trading/trades":
        return <div className="p-6"><h1 className="text-2xl font-bold">Copy Trading Trades</h1><p className="text-muted-foreground">Track and monitor copy trading executions.</p></div>;
      case "/copy-trading/analytics":
        return <div className="p-6"><h1 className="text-2xl font-bold">Copy Trading Analytics</h1><p className="text-muted-foreground">View performance analytics and insights.</p></div>;
      case "/templates":
        return <TemplatesPage />;
      case "/channels":
        return <ChannelsPage />;
      case "/automation":
        return <AutomationPage />;
      case "/trades":
      case "/":
      default:
        return <TradesPage />;
    }
  };

  return (
    <DashboardLayout>
      {renderContent()}
    </DashboardLayout>
  );
}
