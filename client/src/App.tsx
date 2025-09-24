import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TradeHistoryPage from "@/pages/trade-history";
import CopyTradingApplyPage from "@/pages/copy-trading-apply";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import EmbedHeatmapPage from "@/pages/embed/heatmap";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/trade-history" component={TradeHistoryPage} />
      <Route path="/copy-trading/apply" component={CopyTradingApplyPage} />
      
      {/* Embed routes - lightweight for external embedding */}
      <Route path="/embed/heatmap" component={EmbedHeatmapPage} />
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={AuthPage} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/trades" component={Dashboard} />
          <Route path="/copy-trading/users" component={Dashboard} />
          <Route path="/copy-trading/trades" component={Dashboard} />
          <Route path="/templates" component={Dashboard} />
          <Route path="/channels" component={Dashboard} />
          <Route path="/automation" component={Dashboard} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Enable dark theme by default for better card design
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
