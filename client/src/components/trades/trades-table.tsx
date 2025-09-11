import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatTime(trade.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* Actions column kept empty for future use */}
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
    </>
  );
}
