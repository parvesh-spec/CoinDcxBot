import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import TradesPage from "./trades";
import TemplatesPage from "./templates";
import ChannelsPage from "./channels";
import AutomationTestPage from "./automation-test";

export default function Dashboard() {
  const [location] = useLocation();

  const renderContent = () => {
    switch (location) {
      case "/templates":
        return <TemplatesPage />;
      case "/channels":
        return <ChannelsPage />;
      case "/automation":
        return <AutomationTestPage />;
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
