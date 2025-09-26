import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/dashboard-layout";
import TradesPage from "./trades";
import TemplatesPage from "./templates";
import ChannelsPage from "./channels";
import AutomationPage from "./automation";
import CopyTradingUsersPage from "./copy-trading/users";
import CopyTradingTradesPage from "./copy-trading/trades";
import ResearchReportsPage from "./research-reports";
import ResearchReportForm from "./research-report-form";

export default function Dashboard() {
  const [location] = useLocation();

  const renderContent = () => {
    // Handle research report routes
    if (location.startsWith("/research-reports")) {
      if (location === "/research-reports/create" || location.includes("/edit")) {
        return <ResearchReportForm />;
      }
      if (location === "/research-reports") {
        return <ResearchReportsPage />;
      }
      // Handle view individual report (future implementation)
      if (location.match(/^\/research-reports\/[^\/]+$/)) {
        return <ResearchReportsPage />; // For now, redirect to list
      }
    }
    
    switch (location) {
      case "/copy-trading/users":
        return <CopyTradingUsersPage />;
      case "/copy-trading/trades":
        return <CopyTradingTradesPage />;
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
