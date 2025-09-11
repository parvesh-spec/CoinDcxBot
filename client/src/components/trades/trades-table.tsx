import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

// Edit form schema
const editTradeSchema = z.object({
  price: z.string().min(1, "Price is required"),
  leverage: z.coerce.number().min(1, "Leverage must be at least 1").max(100, "Leverage cannot exceed 100"),
  notes: z.string().optional(),
  completionReason: z.enum(['stop_loss_hit', 'target_1_hit', 'target_2_hit', 'target_3_hit', 'safe_book']).optional(),
  safebookPrice: z.string().optional(),
}).refine((data) => {
  // Require safebook price when completion reason is safe_book
  if (data.completionReason === 'safe_book') {
    if (!data.safebookPrice || data.safebookPrice.trim() === '') {
      return false;
    }
    const price = parseFloat(data.safebookPrice);
    if (isNaN(price) || price <= 0) {
      return false;
    }
  }
  return true;
}, {
  message: "Safe book price is required and must be greater than 0 when completion reason is safe book",
  path: ['safebookPrice']
});

type EditTradeFormData = z.infer<typeof editTradeSchema>;

interface Trade {
  id: string;
  tradeId: string;
  pair: string;
  type: string;
  price: string;
  leverage: number;
  takeProfitTrigger?: string | null;
  takeProfit2?: string | null;
  takeProfit3?: string | null;
  stopLossTrigger?: string | null;
  status: string;
  completionReason?: string | null;
  notes?: string | null;
  createdAt: string;
  channel?: {
    name: string;
  };
}

interface TradesTableProps {
  trades: Trade[];
  isLoading: boolean;
  onTradeSelect: (trade: Trade) => void;
  currentPage: number;
  totalTrades: number;
  onPageChange: (page: number) => void;
}

export default function TradesTable({
  trades,
  isLoading,
  onTradeSelect,
  currentPage,
  totalTrades,
  onPageChange,
}: TradesTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Safebook price dialog state
  const [safebookDialog, setSafebookDialog] = useState<{
    isOpen: boolean;
    tradeId: string | null;
    price: string;
  }>({
    isOpen: false,
    tradeId: null,
    price: '',
  });

  // Edit trade dialog state
  const [editDialog, setEditDialog] = useState<{
    isOpen: boolean;
    trade: Trade | null;
  }>({
    isOpen: false,
    trade: null,
  });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    tradeId: string | null;
    tradePair: string | null;
  }>({
    isOpen: false,
    tradeId: null,
    tradePair: null,
  });

  // Mutation for updating target status (T1, T2)
  const updateTargetStatusMutation = useMutation({
    mutationFn: async ({ tradeId, targetType }: { tradeId: string; targetType: 't1' | 't2' }) => {
      return apiRequest('PATCH', `/api/trades/${tradeId}/target-status`, {
        targetType, 
        hit: true
      });
    },
    onMutate: async ({ tradeId, targetType }) => {
      console.log('🎯 Starting optimistic update for:', tradeId, targetType);
      
      // Get all queries that start with "trades" (parent uses ["trades", filters])
      await queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] === "trades" });

      // Snapshot the previous values for all trades queries
      const previousQueries = queryClient.getQueriesData({ predicate: (query) => query.queryKey[0] === "trades" });
      console.log('📊 Previous queries:', previousQueries);

      // Optimistically update all trades queries
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === "trades" },
        (old: any) => {
          console.log('🔄 Updating cache with old data:', old);
          if (!old) return old;
          
          const updated = {
            ...old,
            trades: old.trades.map((trade: any) => {
              if (trade.id === tradeId) {
                const newTargetStatus = { ...(trade.targetStatus || {}) };
                newTargetStatus[targetType] = true;
                console.log('✅ Updated target status:', newTargetStatus);
                return {
                  ...trade,
                  targetStatus: newTargetStatus
                };
              }
              return trade;
            })
          };
          console.log('🚀 New cache data:', updated);
          return updated;
        }
      );

      // Return context with all previous queries
      return { previousQueries };
    },
    onSuccess: () => {
      // Don't invalidate immediately - let optimistic update show first
      setTimeout(() => {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades" });
      }, 100); // Small delay to let user see the optimistic update
      toast({ title: "Target status updated successfully" });
    },
    onError: (error: any, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ 
        title: "Failed to update target status", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Mutation for completing trade
  const completeTradeBaseMutation = useMutation({
    mutationFn: async ({ tradeId, completionReason, safebookPrice }: { 
      tradeId: string; 
      completionReason: string;
      safebookPrice?: string;
    }) => {
      return apiRequest('PATCH', `/api/trades/${tradeId}/complete`, {
        completionReason, 
        safebookPrice
      });
    },
    onMutate: async ({ tradeId, completionReason, safebookPrice }) => {
      console.log('🎯 Starting optimistic trade completion for:', tradeId, completionReason);
      
      // Cancel all trades queries
      await queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] === "trades" });

      // Snapshot previous data
      const previousQueries = queryClient.getQueriesData({ predicate: (query) => query.queryKey[0] === "trades" });

      // Optimistically update trade to completed status
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[0] === "trades" },
        (old: any) => {
          console.log('🔄 Completing trade in cache:', old);
          if (!old) return old;
          
          const updated = {
            ...old,
            trades: old.trades.map((trade: any) => {
              if (trade.id === tradeId) {
                console.log('✅ Marking trade as completed:', completionReason);
                return {
                  ...trade,
                  status: 'completed',
                  completionReason: completionReason,
                  ...(safebookPrice && { safebookPrice })
                };
              }
              return trade;
            })
          };
          console.log('🚀 Updated cache with completed trade:', updated);
          return updated;
        }
      );

      // Return context for rollback
      return { previousQueries };
    },
    onSuccess: () => {
      // Invalidate with delay for smooth UX
      setTimeout(() => {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades" });
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades/stats" || (Array.isArray(query.queryKey) && query.queryKey.includes("/api/trades/stats")) });
      }, 100);
      toast({ title: "Trade completed successfully" });
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ 
        title: "Failed to complete trade", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Mutation for editing trade
  const editTradeMutation = useMutation({
    mutationFn: async ({ tradeId, tradeData }: { tradeId: string; tradeData: any }) => {
      return apiRequest('PUT', `/api/trades/${tradeId}`, tradeData);
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades" });
      }, 100);
      toast({ title: "Trade updated successfully" });
      setEditDialog({ isOpen: false, trade: null });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update trade", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Mutation for deleting trade
  const deleteTradeMutation = useMutation({
    mutationFn: async (tradeId: string) => {
      return apiRequest('DELETE', `/api/trades/${tradeId}`, {});
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades" });
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "trades/stats" || (Array.isArray(query.queryKey) && query.queryKey.includes("/api/trades/stats")) });
      }, 100);
      toast({ title: "Trade deleted successfully" });
      setDeleteDialog({ isOpen: false, tradeId: null, tradePair: null });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete trade", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Handler functions
  const handleTargetHit = (tradeId: string, targetType: 't1' | 't2') => {
    updateTargetStatusMutation.mutate({ tradeId, targetType });
  };

  const handleStopLoss = (tradeId: string) => {
    completeTradeBaseMutation.mutate({ tradeId, completionReason: 'stop_loss_hit' });
  };

  const handleT3Hit = (tradeId: string) => {
    completeTradeBaseMutation.mutate({ tradeId, completionReason: 'target_3_hit' });
  };

  const handleSafebookClick = (tradeId: string) => {
    setSafebookDialog({ isOpen: true, tradeId, price: '' });
  };

  const handleSafebookSubmit = () => {
    if (!safebookDialog.tradeId || !safebookDialog.price) return;
    
    completeTradeBaseMutation.mutate({ 
      tradeId: safebookDialog.tradeId, 
      completionReason: 'safe_book',
      safebookPrice: safebookDialog.price
    });
    
    setSafebookDialog({ isOpen: false, tradeId: null, price: '' });
  };

  const handleEditTrade = (trade: Trade) => {
    setEditDialog({ isOpen: true, trade });
  };

  const handleDeleteTrade = (tradeId: string, tradePair: string) => {
    setDeleteDialog({ isOpen: true, tradeId, tradePair });
  };

  // Function to render target status content
  const renderTargetStatus = (trade: any) => {
    if (trade.status === 'completed') {
      // Show completion reason for completed trades
      const reasonMap: Record<string, string> = {
        'stop_loss_hit': 'Stop Loss Hit',
        'target_1_hit': 'Target 1 Hit',
        'target_2_hit': 'Target 2 Hit', 
        'target_3_hit': 'Target 3 Hit',
        'safe_book': 'Safe Book',
      };
      return (
        <Badge variant="outline" className="text-xs">
          {reasonMap[trade.completionReason] || trade.completionReason}
        </Badge>
      );
    }

    // Parse target status for active trades
    const targetStatus = trade.targetStatus || {};
    
    // Helper function to get button classes based on hit status
    const getButtonClasses = (isHit: boolean, baseClasses: string) => {
      return isHit 
        ? `${baseClasses} bg-green-500 text-white hover:bg-green-600`
        : `${baseClasses} bg-gray-300 text-gray-700 hover:bg-gray-400`;
    };

    // Show clickable actions for active trades
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          className={getButtonClasses(targetStatus.stop_loss, "text-xs h-6 px-2")}
          onClick={() => handleStopLoss(trade.id)}
          disabled={completeTradeBaseMutation.isPending}
          data-testid={`button-stop-loss-${trade.id}`}
        >
          SL
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={getButtonClasses(targetStatus.safebook, "text-xs h-6 px-2")}
          onClick={() => handleSafebookClick(trade.id)}
          disabled={completeTradeBaseMutation.isPending}
          data-testid={`button-safebook-${trade.id}`}
        >
          SB
        </Button>
        {trade.takeProfitTrigger && (
          <Button
            size="sm"
            variant="outline"
            className={getButtonClasses(targetStatus.t1, "text-xs h-6 px-2")}
            onClick={() => handleTargetHit(trade.id, 't1')}
            disabled={updateTargetStatusMutation.isPending}
            data-testid={`button-t1-${trade.id}`}
          >
            T1
          </Button>
        )}
        {trade.takeProfit2 && (
          <Button
            size="sm"
            variant="outline"
            className={getButtonClasses(targetStatus.t2, "text-xs h-6 px-2")}
            onClick={() => handleTargetHit(trade.id, 't2')}
            disabled={updateTargetStatusMutation.isPending}
            data-testid={`button-t2-${trade.id}`}
          >
            T2
          </Button>
        )}
        {trade.takeProfit3 && (
          <Button
            size="sm"
            variant="outline"
            className={getButtonClasses(targetStatus.t3, "text-xs h-6 px-2")}
            onClick={() => handleT3Hit(trade.id)}
            disabled={completeTradeBaseMutation.isPending}
            data-testid={`button-t3-${trade.id}`}
          >
            T3
          </Button>
        )}
      </div>
    );
  };

  // No longer needed - completion is handled in the detail modal

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
            <i className="fas fa-play mr-1" />
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            <i className="fas fa-check mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(parseFloat(price));
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const itemsPerPage = 50;
  const totalPages = Math.ceil(totalTrades / itemsPerPage);

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Pair</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Leverage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stop Loss</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Take Profits</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                <td className="px-6 py-4"><Skeleton className="h-6 w-12" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                <td className="px-6 py-4"><Skeleton className="h-12 w-32" /></td>
                <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
                <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pair
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Price
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Leverage
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Stop Loss
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Take Profits
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Target Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Time
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <div className="text-muted-foreground">
                    <i className="fas fa-chart-line text-2xl mb-2" />
                    <p>No trades found</p>
                    <p className="text-sm">Trades will appear here once your CoinDCX integration is active</p>
                  </div>
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id} data-testid={`row-trade-${trade.id}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trade.pair}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant="secondary"
                      className={
                        trade.type.toLowerCase() === "buy"
                          ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                          : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                      }
                    >
                      {trade.type.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {formatPrice(trade.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    <Badge variant="outline" className="font-mono">
                      {trade.leverage}x
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trade.stopLossTrigger ? formatPrice(trade.stopLossTrigger) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    <div className="space-y-1">
                      {trade.takeProfitTrigger && (
                        <div className="text-xs">TP1: {formatPrice(trade.takeProfitTrigger)}</div>
                      )}
                      {trade.takeProfit2 && (
                        <div className="text-xs">TP2: {formatPrice(trade.takeProfit2)}</div>
                      )}
                      {trade.takeProfit3 && (
                        <div className="text-xs">TP3: {formatPrice(trade.takeProfit3)}</div>
                      )}
                      {!trade.takeProfitTrigger && !trade.takeProfit2 && !trade.takeProfit3 && (
                        <div className="text-xs">-</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {trade.status === "active" ? (
                      <button
                        className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        onClick={() => onTradeSelect(trade)}
                        aria-label="Click to complete trade"
                        data-testid={`status-badge-${trade.id}`}
                      >
                        {getStatusBadge(trade.status)}
                      </button>
                    ) : (
                      <div data-testid={`status-badge-${trade.id}`}>
                        {getStatusBadge(trade.status)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" data-testid={`target-status-${trade.id}`}>
                    {renderTargetStatus(trade)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatTime(trade.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditTrade(trade)}
                        className="text-xs h-7 px-2"
                        data-testid={`button-edit-${trade.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteTrade(trade.id, trade.pair)}
                        className="text-xs h-7 px-2"
                        data-testid={`button-delete-${trade.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalTrades > 0 && (
        <div className="bg-muted px-6 py-3 flex items-center justify-between border-t border-border">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, totalTrades)}
                </span>{" "}
                of <span className="font-medium">{totalTrades}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                  data-testid="button-previous-page"
                >
                  <i className="fas fa-chevron-left h-4 w-4" />
                </Button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className="relative inline-flex items-center px-4 py-2 border text-sm font-medium"
                      data-testid={`button-page-${page}`}
                    >
                      {page}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                  data-testid="button-next-page"
                >
                  <i className="fas fa-chevron-right h-4 w-4" />
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Safebook Price Dialog */}
      <Dialog open={safebookDialog.isOpen} onOpenChange={(open) => 
        setSafebookDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Safebook Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="safebook-price">Price (USDT)</Label>
              <Input
                id="safebook-price"
                type="number"
                step="0.01"
                min="0"
                value={safebookDialog.price}
                onChange={(e) => setSafebookDialog(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Enter safebook price"
                data-testid="input-safebook-price"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setSafebookDialog({ isOpen: false, tradeId: null, price: '' })}
                data-testid="button-cancel-safebook"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSafebookSubmit}
                disabled={!safebookDialog.price || completeTradeBaseMutation.isPending}
                data-testid="button-submit-safebook"
              >
                {completeTradeBaseMutation.isPending ? 'Processing...' : 'Complete Trade'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Trade Dialog */}
      <EditTradeModal 
        isOpen={editDialog.isOpen}
        trade={editDialog.trade}
        onClose={() => setEditDialog({ isOpen: false, trade: null })}
        onSubmit={(data) => {
          if (editDialog.trade) {
            editTradeMutation.mutate({ tradeId: editDialog.trade.id, tradeData: data });
          }
        }}
        isLoading={editTradeMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={(open) => 
        setDeleteDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this trade?
            </p>
            <div className="bg-destructive/10 p-3 rounded-md">
              <p className="text-sm font-medium">Trade: {deleteDialog.tradePair}</p>
              <p className="text-xs text-muted-foreground mt-1">
                This action cannot be undone. The trade will be permanently removed from your records.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialog({ isOpen: false, tradeId: null, tradePair: null })}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (deleteDialog.tradeId) {
                    deleteTradeMutation.mutate(deleteDialog.tradeId);
                  }
                }}
                disabled={deleteTradeMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteTradeMutation.isPending ? 'Deleting...' : 'Delete Trade'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Edit Trade Modal Component
interface EditTradeModalProps {
  isOpen: boolean;
  trade: Trade | null;
  onClose: () => void;
  onSubmit: (data: EditTradeFormData) => void;
  isLoading: boolean;
}

function EditTradeModal({ isOpen, trade, onClose, onSubmit, isLoading }: EditTradeModalProps) {
  const form = useForm<EditTradeFormData>({
    resolver: zodResolver(editTradeSchema),
    defaultValues: {
      price: "",
      leverage: 1,
      notes: "",
      completionReason: undefined,
      safebookPrice: "",
    },
  });

  const watchedCompletionReason = form.watch("completionReason");
  const showSafebookPrice = watchedCompletionReason === "safe_book";

  // Reset form when trade changes
  useEffect(() => {
    if (trade) {
      form.reset({
        price: trade.price || "",
        leverage: trade.leverage || 1,
        notes: trade.notes || "",
        completionReason: trade.completionReason as any || undefined,
        safebookPrice: "",
      });
    }
  }, [trade, form]);

  const handleSubmit = (data: EditTradeFormData) => {
    onSubmit(data);
  };

  const completionReasons = [
    { value: 'target_1_hit', label: 'Target 1 Hit' },
    { value: 'target_2_hit', label: 'Target 2 Hit' },
    { value: 'target_3_hit', label: 'Target 3 Hit' },
    { value: 'stop_loss_hit', label: 'Stop Loss Hit' },
    { value: 'safe_book', label: 'Safe Book' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Trade</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label>Pair: {trade?.pair}</Label>
            </div>
            
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry Price (USDT)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter price"
                      data-testid="input-edit-price"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leverage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leverage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Enter leverage"
                      data-testid="input-edit-leverage"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Trade notes (optional)"
                      data-testid="input-edit-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {trade?.status === 'completed' && (
              <FormField
                control={form.control}
                name="completionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Completion Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-completion-reason">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select completion reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {completionReasons.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showSafebookPrice && (
              <FormField
                control={form.control}
                name="safebookPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Safe Book Price (USDT)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter safe book price"
                        data-testid="input-edit-safebook-price"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isLoading}
                data-testid="button-submit-edit"
              >
                {isLoading ? 'Updating...' : 'Update Trade'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
