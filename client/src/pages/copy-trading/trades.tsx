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
import { AlertCircle, CheckCircle, Clock, XCircle, TrendingUp, TrendingDown } from "lucide-react";

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

// Format execution status with better context
const getExecutionDetails = (trade: any) => {
  if (trade.status === 'executed') {
    return {
      icon: '✅',
      text: 'Trade Executed Successfully',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    };
  } else if (trade.status === 'failed') {
    return {
      icon: '❌',
      text: 'Trade Execution Failed',
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    };
  } else if (trade.status === 'pending') {
    return {
      icon: '⏳',
      text: 'Trade Execution Pending',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    };
  } else {
    return {
      icon: '⚫',
      text: 'Trade Cancelled',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    };
  }
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
              {copyTrades.map((trade) => {
                const executionDetails = getExecutionDetails(trade);
                return (
                  <div
                    key={trade.id}
                    className="border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200"
                    data-testid={`trade-${trade.id}`}
                  >
                    {/* Status Header */}
                    <div className={`px-4 py-3 border-b ${executionDetails.bgColor}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{executionDetails.icon}</span>
                          <div>
                            <div className={`font-medium ${executionDetails.color}`}>
                              {executionDetails.text}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {trade.createdAt 
                                ? format(new Date(trade.createdAt), 'MMM dd, yyyy HH:mm')
                                : 'Unknown time'
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(trade.status)}
                        </div>
                      </div>
                    </div>

                    {/* Trade Details */}
                    <div className="p-4 space-y-4">
                      {/* Main Trade Information */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {trade.originalTrade?.type?.toLowerCase() === 'buy' ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-semibold text-lg">
                                {trade.originalTrade?.pair || 'Unknown Pair'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {trade.originalTrade?.type?.toUpperCase() || 'UNKNOWN'} Order
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Entry Price</div>
                          <div className="text-lg font-bold">
                            ${trade.executedPrice || trade.originalPrice}
                          </div>
                        </div>
                      </div>

                      {/* User Information */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground mb-1">Copy Trader</div>
                        <div className="font-medium">
                          {trade.copyUser?.name || 'Unknown User'}
                          {trade.copyUser?.telegramUsername && (
                            <span className="ml-2 text-muted-foreground">(@{trade.copyUser.telegramUsername})</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Trade Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Original Quantity</div>
                          <div className="font-medium">{trade.originalQuantity}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Executed Quantity</div>
                          <div className="font-medium">
                            {trade.executedQuantity || (
                              <span className="text-yellow-600">Pending</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Stop Loss</div>
                          <div className="font-medium text-red-600">
                            {trade.stopLossPrice ? `$${trade.stopLossPrice}` : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Target</div>
                          <div className="font-medium text-green-600">
                            {trade.takeProfitPrice ? `$${trade.takeProfitPrice}` : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Leverage</div>
                          <div className="font-medium">{trade.leverage}x</div>
                        </div>
                      </div>

                      {/* Order ID for executed trades */}
                      {trade.status === 'executed' && trade.executedTradeId && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                          <div className="text-sm text-muted-foreground mb-1">Exchange Order ID</div>
                          <div className="font-mono text-sm text-green-700 dark:text-green-300">
                            {trade.executedTradeId}
                          </div>
                        </div>
                      )}

                      {/* Error message for failed trades */}
                      {trade.status === 'failed' && trade.errorMessage && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                            <AlertCircle className="h-4 w-4 inline mr-2" />
                            Failure Reason
                          </div>
                          <div className="text-sm text-red-700 dark:text-red-300">
                            {trade.errorMessage}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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