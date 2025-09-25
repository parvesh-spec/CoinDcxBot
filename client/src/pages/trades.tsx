import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import StatsCards from "@/components/trades/stats-cards";
import TradesTable from "@/components/trades/trades-table";
import TradeDetailModal from "@/components/trades/trade-detail-modal";
import CreateTradePage from "./create-trade";
import DeveloperDocsPage from "./developer-docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Code } from "lucide-react";

export default function TradesPage() {
  const { toast } = useToast();
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [showCreateTrade, setShowCreateTrade] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    channelId: "",
    search: "",
    page: 1,
  });

  const { data: tradesData, isLoading: tradesLoading, refetch: refetchTrades, error: tradesError } = useQuery({
    queryKey: ["trades", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (filters.channelId) params.append("channelId", filters.channelId);
      if (filters.search) params.append("search", filters.search);
      params.append("page", filters.page.toString());
      
      const response = await fetch(`/api/trades?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    retry: false,
  });

  const { data: channelsData } = useQuery({
    queryKey: ["/api/channels"],
    retry: false,
  });

  // Handle unauthorized errors
  if (tradesError && isUnauthorizedError(tradesError)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  // Manual sync mutation - fetches trades from CoinDCX API
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/trades/sync');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch trades data
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/stats"] });
      
      toast({
        title: "Sync Complete",
        description: data.message || "Successfully synced with CoinDCX",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync with CoinDCX",
        variant: "destructive",
      });
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  // Show create trade page when requested
  if (showCreateTrade) {
    return <CreateTradePage onBack={() => setShowCreateTrade(false)} />;
  }

  // Show developer docs page when requested
  if (showDeveloper) {
    return <DeveloperDocsPage onBack={() => setShowDeveloper(false)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <StatsCards />

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fas fa-search h-5 w-5 text-muted-foreground" />
                </div>
                <Input
                  type="text"
                  placeholder="Search trades..."
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  data-testid="input-search-trades"
                />
              </div>
              
              <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.channelId || "all"} onValueChange={(value) => handleFilterChange("channelId", value === "all" ? "" : value)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-channel-filter">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {Array.isArray(channelsData) && channelsData.map((channel: any) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={() => setShowCreateTrade(true)}
                data-testid="button-create-trade"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Trade
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowDeveloper(true)}
                data-testid="button-developer"
              >
                <Code className="h-4 w-4 mr-2" />
                Developer
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSync} 
                disabled={syncMutation.isPending}
                data-testid="button-sync"
              >
                <i className={`fas fa-sync -ml-1 mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TradesTable
            trades={Array.isArray((tradesData as any)?.trades) ? (tradesData as any).trades : []}
            isLoading={tradesLoading}
            onTradeSelect={setSelectedTrade}
            currentPage={filters.page}
            totalTrades={(tradesData as any)?.total || 0}
            onPageChange={(page) => handleFilterChange("page", page.toString())}
          />
        </CardContent>
      </Card>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
}
