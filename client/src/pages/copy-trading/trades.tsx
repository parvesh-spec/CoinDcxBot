import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { type CopyTrade, type CopyTradingUser } from "@shared/schema";

// Status badge variants for copy trades
const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case 'executed':
      return <Badge variant="default" className="bg-green-500">{status}</Badge>;
    case 'pending':
      return <Badge variant="secondary">{status}</Badge>;
    case 'failed':
      return <Badge variant="destructive">{status}</Badge>;
    case 'cancelled':
      return <Badge variant="outline">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// Format P&L with colors
const formatPnl = (pnl: string | null) => {
  if (!pnl) return <span className="text-muted-foreground">-</span>;
  const pnlNum = parseFloat(pnl);
  const isPositive = pnlNum >= 0;
  return (
    <span className={isPositive ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
      {isPositive ? '+' : ''}{pnlNum.toFixed(4)}
    </span>
  );
};

export default function CopyTradingTradesPage() {
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);

  // Fetch copy trading users for filter dropdown
  const { data: users = [] } = useQuery({
    queryKey: ["/api/copy-trading/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/copy-trading/users");
      return response.json() as Promise<CopyTradingUser[]>;
    },
  });

  // Fetch copy trades with filtering
  const { data: tradesData, isLoading, refetch } = useQuery({
    queryKey: ["/api/copy-trading/trades", selectedUser, selectedStatus, currentPage, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        limit: limit.toString(),
        offset: ((currentPage - 1) * limit).toString(),
      });
      
      if (selectedUser !== "all") {
        searchParams.append("userId", selectedUser);
      }
      if (selectedStatus !== "all") {
        searchParams.append("status", selectedStatus);
      }

      const response = await apiRequest("GET", `/api/copy-trading/trades?${searchParams.toString()}`);
      return response.json() as Promise<{ copyTrades: (CopyTrade & { 
        copyUser: { name: string; telegramUsername?: string; };
        originalTrade: { pair: string; type: string; price: string; };
      })[]; total: number }>;
    },
  });

  const copyTrades = tradesData?.copyTrades || [];
  const totalTrades = tradesData?.total || 0;
  const totalPages = Math.ceil(totalTrades / limit);

  // Manual sync function (trigger real-time sync)
  const handleManualSync = async () => {
    try {
      const response = await apiRequest("POST", "/api/trades/sync");
      const result = await response.json();
      
      if (result.success) {
        // Refetch trades after successful sync
        refetch();
        // Could add toast notification here
      }
    } catch (error) {
      console.error("Manual sync failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading copy trading trades...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Campus for Wisdom branding */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-primary">Copy Trading Trades</h1>
            <p className="text-muted-foreground mt-1">
              Track and monitor copy trading executions across all users
            </p>
          </div>
          <div className="text-right">
            <Button 
              onClick={handleManualSync}
              variant="outline"
              size="sm"
              data-testid="button-sync-trades"
            >
              <i className="fas fa-sync mr-2" />
              Sync Trades
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter copy trades by user and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Copy Trading User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger data-testid="select-user-filter">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} {user.telegramUsername ? `(@${user.telegramUsername})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Trade Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quick Actions</Label>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedUser("all");
                  setSelectedStatus("all");
                  setCurrentPage(1);
                }}
                data-testid="button-clear-filters"
              >
                <i className="fas fa-times mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-trades">{totalTrades}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Executed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-executed-trades">
              {copyTrades.filter(t => t.status === 'executed').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="stat-pending-trades">
              {copyTrades.filter(t => t.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-failed-trades">
              {copyTrades.filter(t => t.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trades List */}
      {copyTrades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <i className="fas fa-exchange-alt text-4xl text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No copy trades found</h3>
                <p className="text-muted-foreground">
                  {selectedUser !== "all" || selectedStatus !== "all" 
                    ? "Try adjusting your filters or sync new trades."
                    : "Copy trades will appear here once users start trading."}
                </p>
              </div>
              <Button onClick={handleManualSync} variant="outline">
                <i className="fas fa-sync mr-2" />
                Sync New Trades
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Copy Trading History</CardTitle>
            <CardDescription>
              Showing {copyTrades.length} of {totalTrades} copy trades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {copyTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`trade-${trade.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-semibold">
                          {trade.originalTrade?.pair || 'Unknown Pair'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {trade.copyUser?.name || 'Unknown User'}
                          {trade.copyUser?.telegramUsername && (
                            <span className="ml-1">(@{trade.copyUser.telegramUsername})</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">
                        <Badge variant="outline" className="mr-2">
                          {trade.originalTrade?.type?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        {getStatusBadge(trade.status)}
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Price: </span>
                        <span className="font-medium">
                          {trade.executedPrice || trade.originalPrice}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">P&L: </span>
                        {formatPnl(trade.pnl)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional details */}
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Original Qty:</span>
                      <div className="font-medium">{trade.originalQuantity}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Executed Qty:</span>
                      <div className="font-medium">{trade.executedQuantity || 'Pending'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Leverage:</span>
                      <div className="font-medium">{trade.leverage}x</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <div className="font-medium">
                        {trade.createdAt 
                          ? format(new Date(trade.createdAt), 'MMM dd, yyyy HH:mm')
                          : 'Unknown'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Error message for failed trades */}
                  {trade.status === 'failed' && trade.errorMessage && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                        <div className="text-sm font-medium text-red-800 dark:text-red-200">
                          Failure Reason:
                        </div>
                        <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {trade.errorMessage}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <i className="fas fa-chevron-left mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
              <i className="fas fa-chevron-right ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}