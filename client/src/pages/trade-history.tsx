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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trades.map((trade) => (
            <Card key={trade.id} className="hover:shadow-lg transition-shadow relative" data-testid={`trade-card-${trade.id}`}>
              {/* Time in corner */}
              <div className="absolute top-2 right-2 text-xs text-muted-foreground" data-testid={`text-time-${trade.id}`}>
                {trade.updatedAt 
                  ? formatDistanceToNow(new Date(trade.updatedAt), { addSuffix: true })
                  : trade.createdAt 
                    ? formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })
                    : 'Unknown'
                }
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between pr-16">
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
              </CardHeader>

              <CardContent className="space-y-2 pt-0">
                {/* Price & Leverage */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-semibold text-sm" data-testid={`text-price-${trade.id}`}>
                      ₹{trade.price ? Number(trade.price).toLocaleString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  {trade.leverage && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Leverage</p>
                      <p className="font-semibold text-sm text-blue-600" data-testid={`text-leverage-${trade.id}`}>
                        {trade.leverage}x
                      </p>
                    </div>
                  )}
                </div>

                {/* Stop Loss with completion mark */}
                {trade.stopLossTrigger && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stop Loss</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-red-600" data-testid={`text-stop-loss-${trade.id}`}>
                        ₹{Number(trade.stopLossTrigger).toLocaleString('en-IN')}
                      </span>
                      {trade.completionReason === 'stop_loss_hit' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">HIT</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Take Profits in one compact line */}
                {(trade.takeProfitTrigger || trade.takeProfit2 || trade.takeProfit3) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Take Profits</p>
                    <div className="flex items-center gap-3 text-sm">
                      {trade.takeProfitTrigger && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-green-600" data-testid={`text-take-profit1-${trade.id}`}>
                            T1: ₹{Number(trade.takeProfitTrigger).toLocaleString('en-IN')}
                          </span>
                          {trade.completionReason === 'target_1_hit' && (
                            <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">✓</span>
                          )}
                        </div>
                      )}
                      
                      {trade.takeProfit2 && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-green-600" data-testid={`text-take-profit2-${trade.id}`}>
                            T2: ₹{Number(trade.takeProfit2).toLocaleString('en-IN')}
                          </span>
                          {trade.completionReason === 'target_2_hit' && (
                            <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">✓</span>
                          )}
                        </div>
                      )}
                      
                      {trade.takeProfit3 && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-green-600" data-testid={`text-take-profit3-${trade.id}`}>
                            T3: ₹{Number(trade.takeProfit3).toLocaleString('en-IN')}
                          </span>
                          {trade.completionReason === 'target_3_hit' && (
                            <span className="text-xs bg-green-100 text-green-700 px-1 py-0.5 rounded">✓</span>
                          )}
                        </div>
                      )}
                    </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}