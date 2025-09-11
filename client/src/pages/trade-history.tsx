import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from "date-fns";
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
    queryKey: ["/api/public/trades/completed"],
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

  // Group trades by date
  const groupedTrades = filteredTrades.reduce((groups, trade) => {
    const tradeDate = trade.updatedAt ? new Date(trade.updatedAt) : new Date(trade.createdAt!);
    const dateKey = format(tradeDate, 'yyyy-MM-dd');
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(trade);
    
    return groups;
  }, {} as Record<string, TradeWithGainLoss[]>);

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedTrades).sort((a, b) => b.localeCompare(a));
  
  // Helper function to format date headers
  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };
  
  // Calculate statistics
  const totalTrades = trades.length;
  const currentMonth = format(new Date(), 'yyyy-MM');
  const thisMonthTrades = trades.filter(trade => {
    const tradeDate = trade.updatedAt ? new Date(trade.updatedAt) : new Date(trade.createdAt!);
    return format(tradeDate, 'yyyy-MM') === currentMonth;
  });
  
  // Only count trades that have gainLoss data for accurate calculations
  const thisMonthWithGainLoss = thisMonthTrades.filter(trade => trade.gainLoss);
  const gainTrades = thisMonthWithGainLoss.filter(trade => trade.gainLoss?.isGain);
  const accuracy = thisMonthWithGainLoss.length > 0 ? Math.round((gainTrades.length / thisMonthWithGainLoss.length) * 100) : 0;
  
  // Calculate average gain % this month (only from trades with gainLoss data)
  const avgGain = thisMonthWithGainLoss.length > 0 
    ? thisMonthWithGainLoss.reduce((sum, trade) => {
        if (trade.gainLoss!.isGain) {
          return sum + trade.gainLoss!.percentage;
        } else {
          return sum - trade.gainLoss!.percentage;
        }
      }, 0) / thisMonthWithGainLoss.length
    : 0;

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-6 py-6">
        {/* Branding and Quote */}
        <div className="text-center mb-6">
          <div className="mb-4">
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
              📚 Campus For Wisdom
            </h1>
            <p className="text-xs italic text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-3">
              "Consistency in trading beats perfection. Profit and loss are just part of the journey, discipline is the destination."
            </p>
            
            {/* Statistics */}
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-300">{totalTrades}</p>
                <p className="text-slate-500 dark:text-slate-400">Total Trades</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-300">{accuracy}%</p>
                <p className="text-slate-500 dark:text-slate-400">Accuracy</p>
              </div>
              <div className="text-center">
                <p className={`font-semibold ${avgGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {avgGain >= 0 ? '+' : ''}{avgGain.toFixed(1)}%
                </p>
                <p className="text-slate-500 dark:text-slate-400">This Month</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Header and Filter */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Trade History
            </h2>
          </div>
          
          {/* Date Filter */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-36 h-8 text-xs border-slate-200 dark:border-slate-700"
              placeholder="Filter by date"
              data-testid="input-date-filter"
            />
            {dateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateFilter("")}
                className="h-8 px-3 text-xs"
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
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              {/* Date Header */}
              <div className="flex items-center justify-center mb-4">
                <div className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {getDateLabel(dateKey)}
                  </span>
                </div>
              </div>
              
              {/* Trades for this date */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupedTrades[dateKey].map((trade) => (
                  <Card key={trade.id} className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-200 rounded-lg overflow-hidden" data-testid={`trade-card-${trade.id}`}>

              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-start justify-between pr-6">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {trade.pair}
                    </CardTitle>
                    <Badge 
                      className={`mt-1 px-2 py-0.5 text-[10px] font-medium ${
                        trade.type === 'buy' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}
                      data-testid={`badge-type-${trade.type}`}
                    >
                      {trade.type.toUpperCase()}
                    </Badge>
                  </div>
                  
                  {/* Gain/Loss Display - Better positioned */}
                  {trade.gainLoss && (
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded px-2 py-1 border border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-1">
                        {trade.gainLoss.isGain ? (
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-xs font-semibold ${
                          trade.gainLoss.isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {trade.gainLoss.isGain ? '+' : '-'}{trade.gainLoss.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 px-3 pb-6 pr-6">
                {/* Price & Leverage */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Price</p>
                    <p className="font-semibold text-xs text-slate-700 dark:text-slate-300" data-testid={`text-price-${trade.id}`}>
                      ₹{trade.price ? Number(trade.price).toLocaleString('en-IN') : 'N/A'}
                    </p>
                  </div>
                  {trade.leverage && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Lev</p>
                      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300" data-testid={`text-leverage-${trade.id}`}>
                        {trade.leverage}x
                      </p>
                    </div>
                  )}
                </div>

                {/* Stop Loss with completion mark */}
                {trade.stopLossTrigger && (
                  <div className={`p-2 rounded border transition-all ${
                    trade.completionReason === 'stop_loss_hit' 
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' 
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Stop Loss</span>
                      {trade.completionReason === 'stop_loss_hit' && (
                        <Star className="w-3 h-3 text-red-500 fill-red-500" />
                      )}
                    </div>
                    <p className="font-semibold text-xs text-red-600 dark:text-red-400 mt-0.5" data-testid={`text-stop-loss-${trade.id}`}>
                      ₹{Number(trade.stopLossTrigger).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                {/* Take Profits in compact boxes */}
                {(trade.takeProfitTrigger || trade.takeProfit2 || trade.takeProfit3) && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">Targets</p>
                    <div className="flex gap-1">
                      {trade.takeProfitTrigger && (
                        <div className={`flex-1 p-1.5 rounded border transition-all ${
                          trade.completionReason === 'target_1_hit' 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' 
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">T1</span>
                            {trade.completionReason === 'target_1_hit' && (
                              <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit1-${trade.id}`}>
                            ₹{Number(trade.takeProfitTrigger).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {trade.takeProfit2 && (
                        <div className={`flex-1 p-1.5 rounded border transition-all ${
                          trade.completionReason === 'target_2_hit' 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' 
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">T2</span>
                            {trade.completionReason === 'target_2_hit' && (
                              <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit2-${trade.id}`}>
                            ₹{Number(trade.takeProfit2).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {/* Show T3 or Safebook based on completion reason */}
                      {trade.takeProfit3 && trade.completionReason !== 'safe_book' && (
                        <div className={`flex-1 p-1.5 rounded border transition-all ${
                          trade.completionReason === 'target_3_hit' 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' 
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">T3</span>
                            {trade.completionReason === 'target_3_hit' && (
                              <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit3-${trade.id}`}>
                            ₹{Number(trade.takeProfit3).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {/* Show Safebook when completion reason is safe_book */}
                      {trade.completionReason === 'safe_book' && trade.safebookPrice && (
                        <div className="flex-1 p-1.5 rounded border transition-all bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Safebook</span>
                            <Star className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                          </div>
                          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300" data-testid={`text-safebook-${trade.id}`}>
                            ₹{Number(trade.safebookPrice).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800/50">
                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-0.5">Notes</p>
                    <p className="text-[10px] text-amber-800 dark:text-amber-300 break-words leading-3" data-testid={`text-notes-${trade.id}`}>
                      {trade.notes}
                    </p>
                  </div>
                )}
                
                {/* Time in bottom corner with reserved space */}
                <div className="absolute bottom-1.5 right-1.5 text-[8px] text-slate-400 dark:text-slate-500 bg-slate-50/90 dark:bg-slate-800/90 px-1.5 py-0.5 rounded" data-testid={`text-time-${trade.id}`}>
                  {trade.updatedAt 
                    ? format(new Date(trade.updatedAt), 'HH:mm')
                    : trade.createdAt 
                      ? format(new Date(trade.createdAt), 'HH:mm')
                      : 'N/A'
                  }
                </div>
              </CardContent>
                </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}