import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import TradesPage from "./trades";
import TemplatesPage from "./templates";
import ChannelsPage from "./channels";

export default function Dashboard() {
  const [location] = useLocation();

  const renderContent = () => {
    switch (location) {
      case "/templates":
        return <TemplatesPage />;
      case "/channels":
        return <ChannelsPage />;
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
