import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TradeHistoryPage from "@/pages/trade-history";
import NotFound from "@/pages/not-found";
import { useEffect, lazy, Suspense } from "react";

// Lazy load embed page for code-splitting
const EmbedHeatmapPage = lazy(() => import("@/pages/embed/heatmap"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/trade-history" component={TradeHistoryPage} />
      
      {/* Embed routes - lightweight for external embedding */}
      <Route path="/embed/heatmap">
        <Suspense fallback={
          <div className="bg-white min-h-screen flex items-center justify-center">
            <div className="animate-pulse bg-slate-200 rounded-lg p-8">
              Loading widget...
            </div>
          </div>
        }>
          <EmbedHeatmapPage />
        </Suspense>
      </Route>
      
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={AuthPage} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/trades" component={Dashboard} />
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
