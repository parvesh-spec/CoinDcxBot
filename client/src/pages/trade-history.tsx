import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import { Calendar, Star, TrendingUp, TrendingDown } from "lucide-react";
import { Trade } from "@shared/schema";

type TradeWithGainLoss = Trade & {
  gainLoss?: {
    percentage: number;
    isGain: boolean;
  };
};

interface TradeHistoryResponse {
  trades: TradeWithGainLoss[];
  total: number;
}

export default function TradeHistoryPage() {
  const [dateFilter, setDateFilter] = useState("");
  
  const { data, isLoading } = useQuery<TradeHistoryResponse>({
    queryKey: ["/api/public/trades/completed", dateFilter],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { trades = [], total = 0 } = data || {};
  
  // Filter trades by date if filter is applied
  const filteredTrades = dateFilter 
    ? trades.filter(trade => {
        if (!trade.updatedAt) return false;
        const tradeDate = format(new Date(trade.updatedAt), 'yyyy-MM-dd');
        return tradeDate === dateFilter;
      })
    : trades;

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Trade History
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete record of all finished trades ({total} total)
          </p>
          
          {/* Date Filter */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-48 text-center"
              placeholder="Filter by date"
              data-testid="input-date-filter"
            />
            {dateFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateFilter("")}
                data-testid="button-clear-filter"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

      {filteredTrades.length === 0 ? (
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
          {filteredTrades.map((trade) => (
            <Card key={trade.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-0 shadow-xl" data-testid={`trade-card-${trade.id}`}>
              <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded-full" data-testid={`text-time-${trade.id}`}>
                {trade.updatedAt 
                  ? formatDistanceToNow(new Date(trade.updatedAt), { addSuffix: true })
                  : trade.createdAt 
                    ? formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })
                    : 'Unknown'
                }
              </div>

              <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10">
                <div className="flex items-center justify-between pr-20">
                  <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
                    {trade.pair}
                  </CardTitle>
                  <Badge 
                    className={`px-3 py-1 text-sm font-semibold ${
                      trade.type === 'buy' 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                        : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                    }`}
                    data-testid={`badge-type-${trade.type}`}
                  >
                    {trade.type.toUpperCase()}
                  </Badge>
                </div>
                
                {/* Gain/Loss Display */}
                {trade.gainLoss && (
                  <div className="flex items-center gap-2 mt-2">
                    {trade.gainLoss.isGain ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`text-lg font-bold ${
                      trade.gainLoss.isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {trade.gainLoss.isGain ? '+' : '-'}{trade.gainLoss.percentage.toFixed(2)}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {trade.gainLoss.isGain ? 'Gain' : 'Loss'}
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {/* Price & Leverage */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Entry Price</p>
                    <p className="font-bold text-lg text-blue-800 dark:text-blue-100" data-testid={`text-price-${trade.id}`}>
                      ₹{trade.price ? Number(trade.price).toLocaleString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  {trade.leverage && (
                    <div className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 p-3 rounded-lg">
                      <p className="text-xs text-purple-600 dark:text-purple-300 font-medium">Leverage</p>
                      <p className="font-bold text-lg text-purple-800 dark:text-purple-100" data-testid={`text-leverage-${trade.id}`}>
                        {trade.leverage}x
                      </p>
                    </div>
                  )}
                </div>

                {/* Stop Loss with completion mark */}
                {trade.stopLossTrigger && (
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    trade.completionReason === 'stop_loss_hit' 
                      ? 'bg-gradient-to-br from-red-100 to-red-200 border-red-300 dark:from-red-900 dark:to-red-800 dark:border-red-600' 
                      : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Stop Loss</span>
                      {trade.completionReason === 'stop_loss_hit' && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-red-500 fill-red-500" />
                          <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold">HIT</span>
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-lg text-red-600 dark:text-red-400 mt-1" data-testid={`text-stop-loss-${trade.id}`}>
                      ₹{Number(trade.stopLossTrigger).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                {/* Take Profits in colorful boxes */}
                {(trade.takeProfitTrigger || trade.takeProfit2 || trade.takeProfit3) && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Take Profits</p>
                    <div className="grid grid-cols-3 gap-2">
                      {trade.takeProfitTrigger && (
                        <div className={`p-2 rounded-lg border-2 transition-all ${
                          trade.completionReason === 'target_1_hit' 
                            ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-300 dark:from-green-900 dark:to-green-800 dark:border-green-600' 
                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">T1</span>
                            {trade.completionReason === 'target_1_hit' && (
                              <Star className="w-3 h-3 text-green-500 fill-green-500" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300" data-testid={`text-take-profit1-${trade.id}`}>
                            ₹{Number(trade.takeProfitTrigger).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {trade.takeProfit2 && (
                        <div className={`p-2 rounded-lg border-2 transition-all ${
                          trade.completionReason === 'target_2_hit' 
                            ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-300 dark:from-green-900 dark:to-green-800 dark:border-green-600' 
                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">T2</span>
                            {trade.completionReason === 'target_2_hit' && (
                              <Star className="w-3 h-3 text-green-500 fill-green-500" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300" data-testid={`text-take-profit2-${trade.id}`}>
                            ₹{Number(trade.takeProfit2).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {trade.takeProfit3 && (
                        <div className={`p-2 rounded-lg border-2 transition-all ${
                          trade.completionReason === 'target_3_hit' 
                            ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-300 dark:from-green-900 dark:to-green-800 dark:border-green-600' 
                            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800 dark:to-gray-700 dark:border-gray-600'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">T3</span>
                            {trade.completionReason === 'target_3_hit' && (
                              <Star className="w-3 h-3 text-green-500 fill-green-500" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300" data-testid={`text-take-profit3-${trade.id}`}>
                            ₹{Number(trade.takeProfit3).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900 dark:to-orange-900 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Notes</p>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 break-words" data-testid={`text-notes-${trade.id}`}>
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
    </div>
  );
}