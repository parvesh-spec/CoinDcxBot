import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Trade } from "@shared/schema";

interface TradeHistoryResponse {
  trades: Trade[];
  total: number;
}

export default function TradeHistoryPage() {
  const { data, isLoading } = useQuery<TradeHistoryResponse>({
    queryKey: ["/api/public/trades/completed"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { trades = [], total = 0 } = data || {};

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading trade history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Trade History
        </h1>
        <p className="text-muted-foreground">
          Complete record of all finished trades ({total} total)
        </p>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-muted rounded-lg p-8 max-w-md mx-auto">
            <p className="text-lg text-muted-foreground mb-2">No completed trades yet</p>
            <p className="text-sm text-muted-foreground">
              Completed trades will appear here automatically
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trades.map((trade) => (
            <Card key={trade.id} className="hover:shadow-lg transition-shadow" data-testid={`trade-card-${trade.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {trade.pair}
                  </CardTitle>
                  <Badge 
                    variant={trade.type === 'buy' ? 'default' : 'secondary'}
                    className="text-xs font-medium"
                    data-testid={`badge-type-${trade.type}`}
                  >
                    {trade.type.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {trade.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Price & Total */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-semibold text-sm" data-testid={`text-price-${trade.id}`}>
                      ₹{trade.price ? Number(trade.price).toLocaleString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold text-sm" data-testid={`text-total-${trade.id}`}>
                      ₹{trade.total ? Number(trade.total).toLocaleString('en-IN') : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Leverage */}
                {trade.leverage && (
                  <div>
                    <p className="text-xs text-muted-foreground">Leverage</p>
                    <p className="font-semibold text-sm text-blue-600" data-testid={`text-leverage-${trade.id}`}>
                      {trade.leverage}x
                    </p>
                  </div>
                )}

                {/* Stop Loss */}
                {trade.stopLossTrigger && (
                  <div>
                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                    <p className="font-semibold text-sm text-red-600" data-testid={`text-stop-loss-${trade.id}`}>
                      ₹{Number(trade.stopLossTrigger).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                {/* Take Profits */}
                <div className="space-y-2">
                  {trade.takeProfitTrigger && (
                    <div>
                      <p className="text-xs text-muted-foreground">Take Profit 1</p>
                      <p className="font-semibold text-sm text-green-600" data-testid={`text-take-profit1-${trade.id}`}>
                        ₹{Number(trade.takeProfitTrigger).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}
                  
                  {trade.takeProfit2 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Take Profit 2</p>
                      <p className="font-semibold text-sm text-green-600" data-testid={`text-take-profit2-${trade.id}`}>
                        ₹{Number(trade.takeProfit2).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}
                  
                  {trade.takeProfit3 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Take Profit 3</p>
                      <p className="font-semibold text-sm text-green-600" data-testid={`text-take-profit3-${trade.id}`}>
                        ₹{Number(trade.takeProfit3).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Completion Details */}
                {trade.completionReason && (
                  <div>
                    <p className="text-xs text-muted-foreground">Completion Reason</p>
                    <p className="font-medium text-sm" data-testid={`text-completion-reason-${trade.id}`}>
                      {trade.completionReason}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground break-words" data-testid={`text-notes-${trade.id}`}>
                      {trade.notes}
                    </p>
                  </div>
                )}

                {/* Time */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-sm font-medium" data-testid={`text-time-${trade.id}`}>
                    {trade.completedAt 
                      ? formatDistanceToNow(new Date(trade.completedAt), { addSuffix: true })
                      : formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}