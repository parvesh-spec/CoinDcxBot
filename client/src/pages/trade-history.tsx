import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format, isToday, isYesterday, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from "date-fns";
import { Calendar, Star, TrendingUp, TrendingDown, Filter, ExternalLink } from "lucide-react";
import campusLogo from "@assets/6208450096694152058_1758021301213.jpg";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trade, TargetStatusV2 } from "@shared/schema";

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

type FilterType = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export default function TradeHistoryPage() {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  
  const { data, isLoading } = useQuery<TradeHistoryResponse>({
    queryKey: ["/api/public/trades/completed"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { trades = [], total = 0 } = data || {};
  
  // Enhanced filtering logic based on filter type
  const getFilteredTrades = () => {
    const now = new Date();
    
    switch (filterType) {
      case 'today':
        return trades.filter(trade => {
          if (!trade.createdAt) return false;
          const tradeDate = new Date(trade.createdAt);
          return isWithinInterval(tradeDate, {
            start: startOfDay(now),
            end: endOfDay(now)
          });
        });
        
      case 'yesterday':
        return trades.filter(trade => {
          if (!trade.createdAt) return false;
          const tradeDate = new Date(trade.createdAt);
          const yesterday = subDays(now, 1);
          return isWithinInterval(tradeDate, {
            start: startOfDay(yesterday),
            end: endOfDay(yesterday)
          });
        });
        
      case 'this_week':
        return trades.filter(trade => {
          if (!trade.createdAt) return false;
          const tradeDate = new Date(trade.createdAt);
          return isWithinInterval(tradeDate, {
            start: startOfWeek(now, { weekStartsOn: 1 }), // Monday start
            end: endOfWeek(now, { weekStartsOn: 1 })
          });
        });
        
      case 'this_month':
        return trades.filter(trade => {
          if (!trade.createdAt) return false;
          const tradeDate = new Date(trade.createdAt);
          return isWithinInterval(tradeDate, {
            start: startOfMonth(now),
            end: endOfMonth(now)
          });
        });
        
      case 'custom':
        if (!customDateRange.start || !customDateRange.end) return trades;
        return trades.filter(trade => {
          if (!trade.createdAt) return false;
          const tradeDate = new Date(trade.createdAt);
          const now = new Date();
          const startDate = startOfDay(new Date(customDateRange.start));
          const requestedEndDate = endOfDay(new Date(customDateRange.end));
          const todayEnd = endOfDay(now);
          
          // Clamp end date to today if it's in the future
          const endDate = requestedEndDate > todayEnd ? todayEnd : requestedEndDate;
          
          // Prevent crash if end date is before start date or if start date is in future
          if (endDate < startDate || startDate > todayEnd) return false;
          
          return isWithinInterval(tradeDate, { start: startDate, end: endDate });
        });
        
      default: // 'all'
        return trades;
    }
  };
  
  const filteredTrades = getFilteredTrades();

  // Group trades by date
  const groupedTrades = filteredTrades.reduce((groups, trade) => {
    if (!trade.createdAt) return groups; // Skip trades without createdAt
    const tradeDate = new Date(trade.createdAt);
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
  
  // Calculate statistics based on filtered trades
  const calculateStats = (trades: TradeWithGainLoss[]) => {
    const totalTrades = trades.length;
    const tradesWithGainLoss = trades.filter(trade => trade.gainLoss);
    const gainTrades = tradesWithGainLoss.filter(trade => trade.gainLoss?.isGain);
    const accuracy = tradesWithGainLoss.length > 0 ? Math.round((gainTrades.length / tradesWithGainLoss.length) * 100) : 0;
    
    const totalGain = tradesWithGainLoss.length > 0 
      ? tradesWithGainLoss.reduce((sum, trade) => {
          if (trade.gainLoss!.isGain) {
            return sum + trade.gainLoss!.percentage;
          } else {
            return sum - trade.gainLoss!.percentage;
          }
        }, 0)
      : 0;
      
    return { totalTrades, accuracy, totalGain };
  };
  
  const stats = calculateStats(filteredTrades);
  
  // Get filter label for display
  const getFilterLabel = () => {
    switch (filterType) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'this_week': return 'This Week';
      case 'this_month': return 'This Month';
      case 'custom': return 'Custom Range';
      default: return 'All Time';
    }
  };

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
      {/* Professional Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo Section */}
            <div className="flex items-center space-x-4">
              <img 
                src={campusLogo} 
                alt="Campus For Wisdom" 
                className="h-20 w-auto object-contain"
                data-testid="campus-logo"
              />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  Trade Analytics
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Real-time trading performance insights
                </p>
              </div>
            </div>
            
            {/* CTA Button */}
            <a
              href="https://telegram.me/campusforwisdom"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
              data-testid="cta-join-community"
            >
              <span className="text-sm">Join Free Community</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Statistics and Filter Display */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
          <div className="text-center mb-4">
            <p className="text-xs italic text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-4">
              "Consistency in trading beats perfection. Profit and loss are just part of the journey, discipline is the destination."
            </p>
            
            {/* Statistics */}
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.totalTrades}</p>
                <p className="text-slate-500 dark:text-slate-400">Total Trades</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.accuracy}%</p>
                <p className="text-slate-500 dark:text-slate-400">Accuracy</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${stats.totalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stats.totalGain >= 0 ? '+' : ''}{stats.totalGain.toFixed(1)}%
                </p>
                <p className="text-slate-500 dark:text-slate-400">Profit/Loss%</p>
              </div>
            </div>
            
            {/* Current Filter Display */}
            {filterType !== 'all' && (
              <div className="mt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                  <Filter className="w-4 h-4" />
                  <span>Showing: {getFilterLabel()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Header and Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Trade History
            </h2>
          </div>
          
          {/* Enhanced Filter */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
              <SelectTrigger className="w-32 h-8 text-xs border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Date Range</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Custom Date Range Inputs - Responsive */}
            {filterType === 'custom' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
                <Input
                  type="date"
                  value={customDateRange.start}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const value = e.target.value;
                    const today = format(new Date(), 'yyyy-MM-dd');
                    setCustomDateRange(prev => ({ ...prev, start: value > today ? today : value }));
                  }}
                  className="w-full sm:w-28 h-8 text-xs border-slate-200 dark:border-slate-700"
                  placeholder="Start date"
                  data-testid="input-start-date"
                />
                <span className="text-slate-400 text-xs text-center sm:text-left">to</span>
                <Input
                  type="date"
                  value={customDateRange.end}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const value = e.target.value;
                    const today = format(new Date(), 'yyyy-MM-dd');
                    setCustomDateRange(prev => ({ ...prev, end: value > today ? today : value }));
                  }}
                  className="w-full sm:w-28 h-8 text-xs border-slate-200 dark:border-slate-700"
                  placeholder="End date"
                  data-testid="input-end-date"
                />
              </div>
            )}
            
            {filterType !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType('all');
                  setCustomDateRange({ start: '', end: '' });
                }}
                className="h-8 px-3 text-xs shrink-0 sm:w-auto w-full"
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
              
              {/* Trades for this date - Mobile: NEW COMPACT RECTANGULAR DESIGN */}
              <div 
                className="md:hidden -mx-6 px-6 overflow-x-auto snap-x snap-mandatory scroll-px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [overscroll-behavior-x:contain]" 
                aria-label={`Trades for ${getDateLabel(dateKey)}`}
                data-testid={`scroll-day-${dateKey}`}
                style={{ overflowY: 'visible', overflowX: 'auto' }}
              >
                <div className="flex gap-3 pb-2 pt-4" style={{ overflow: 'visible' }}>
                  {groupedTrades[dateKey].map((trade) => {
                    // Helper function to format decimal numbers removing trailing zeros
                    const formatDecimal = (value: string | number | null) => {
                      if (value === null || value === undefined) return 'N/A';
                      const num = Number(value);
                      if (Number.isNaN(num)) return 'N/A';
                      return num.toString(); // This automatically removes trailing zeros
                    };

                    // Helper to format currency values
                    const formatCurrency = (value: string | number | null) => {
                      const formatted = formatDecimal(value);
                      return formatted === 'N/A' ? formatted : `$${formatted}`;
                    };

                    // Determine completion result for circle
                    const getCompletionResult = () => {
                      if (trade.completionReason === 'stop_loss_hit') return { type: 'STOP LOSS', color: 'red' };
                      if (trade.completionReason === 'safe_book') return { type: 'SAFEBOOK', color: 'green' };
                      if (trade.completionReason === 'target_1_hit') return { type: 'TARGET 1', color: 'green' };
                      if (trade.completionReason === 'target_2_hit') return { type: 'TARGET 2', color: 'green' };
                      if (trade.completionReason === 'target_3_hit') return { type: 'TARGET 3', color: 'green' };
                      return { type: 'PENDING', color: 'gray' };
                    };

                    const result = getCompletionResult();
                    
                    return (
                      <div key={trade.id} className="min-w-[280px] max-w-[320px] w-auto snap-start shrink-0" data-testid={`mobile-trade-card-${trade.id}`} style={{ overflow: 'visible' }}>
                        {/* NEW COMPACT RECTANGULAR CARD - INCREASED HEIGHT */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-lg h-[160px] relative" style={{ overflow: 'visible' }}>
                          
                          {/* Buy/Sell Type on Card Boundary - Corner Position, Half Outside */}
                          <div className="absolute top-0 right-1 z-20 -translate-y-1/2">
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-lg ${
                              trade.type.toLowerCase() === 'buy' 
                                ? 'bg-green-500 text-white border-green-400' 
                                : 'bg-red-500 text-white border-red-400'
                            }`} data-testid={`type-${trade.id}`}>
                              {trade.type.toUpperCase()}
                            </div>
                          </div>

                          {/* TOP SECTION (80% height) - Split 1:1 left/right */}
                          <div className="flex h-[128px]">
                            
                            {/* LEFT SECTION (50%) - Result Circle + Profit/Loss */}
                            <div className="w-1/2 p-3 flex flex-col items-center justify-center">
                              {/* Result Circle - BIGGER with HIT text and TWINKLING STARS */}
                              <div className="relative">
                                {/* Twinkling Stars Animation */}
                                {result.type !== 'PENDING' && (
                                  <>
                                    <div className={`absolute -top-1 -right-1 w-1 h-1 rounded-full ${
                                      result.color === 'green' ? 'bg-green-400' : 'bg-red-400'
                                    } animate-pulse`} style={{ 
                                      animation: 'twinkle 1.5s ease-in-out infinite',
                                      animationDelay: '0s' 
                                    }}></div>
                                    <div className={`absolute -top-2 left-2 w-0.5 h-0.5 rounded-full ${
                                      result.color === 'green' ? 'bg-green-300' : 'bg-red-300'
                                    }`} style={{ 
                                      animation: 'twinkle 2s ease-in-out infinite',
                                      animationDelay: '0.3s' 
                                    }}></div>
                                    <div className={`absolute top-1 -left-2 w-1 h-1 rounded-full ${
                                      result.color === 'green' ? 'bg-green-500' : 'bg-red-500'
                                    }`} style={{ 
                                      animation: 'twinkle 1.8s ease-in-out infinite',
                                      animationDelay: '0.6s' 
                                    }}></div>
                                    <div className={`absolute -bottom-1 -left-1 w-0.5 h-0.5 rounded-full ${
                                      result.color === 'green' ? 'bg-green-400' : 'bg-red-400'
                                    }`} style={{ 
                                      animation: 'twinkle 1.2s ease-in-out infinite',
                                      animationDelay: '0.9s' 
                                    }}></div>
                                    <div className={`absolute -bottom-2 right-3 w-1 h-1 rounded-full ${
                                      result.color === 'green' ? 'bg-green-300' : 'bg-red-300'
                                    }`} style={{ 
                                      animation: 'twinkle 2.2s ease-in-out infinite',
                                      animationDelay: '1.2s' 
                                    }}></div>
                                    <div className={`absolute top-3 -right-3 w-0.5 h-0.5 rounded-full ${
                                      result.color === 'green' ? 'bg-green-500' : 'bg-red-500'
                                    }`} style={{ 
                                      animation: 'twinkle 1.7s ease-in-out infinite',
                                      animationDelay: '1.5s' 
                                    }}></div>
                                  </>
                                )}
                                
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                                  result.color === 'green' 
                                    ? 'border-green-400 bg-green-500/20' 
                                    : result.color === 'red' 
                                      ? 'border-red-400 bg-red-500/20' 
                                      : 'border-gray-400 bg-gray-500/20'
                                }`} data-testid={`circle-result-${trade.id}`}>
                                  <div className="text-center">
                                    <div className={`text-[10px] font-bold leading-tight ${
                                      result.color === 'green' 
                                        ? 'text-green-300' 
                                        : result.color === 'red' 
                                          ? 'text-red-300' 
                                          : 'text-gray-300'
                                    }`}>
                                      {result.type === 'SAFEBOOK' ? 'SAFEBOOK' : result.type.replace(' HIT', '')}
                                      {result.type !== 'PENDING' && result.type !== 'SAFEBOOK' && (
                                        <div className="text-[9px] mt-0.5 opacity-90">HIT</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Profit/Loss Percentage */}
                              {trade.gainLoss && (
                                <div className="mt-2 text-center">
                                  <span className={`text-sm font-bold ${
                                    trade.gainLoss.isGain ? 'text-green-400' : 'text-red-400'
                                  }`} data-testid={`profit-loss-${trade.id}`}>
                                    {trade.gainLoss.isGain ? '+' : ''}{trade.gainLoss.percentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* RIGHT SECTION (50%) - Trade Information - TRUE HORIZONTAL LAYOUT */}
                            <div className="w-1/2 p-3 pr-2">
                              <div className="mb-2">
                                <p className="text-white font-bold text-sm" data-testid={`pair-${trade.id}`}>{trade.pair}</p>
                              </div>
                              
                              {/* Entry, SL, Leverage - INLINE with proper wrapping */}
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-400 flex-shrink-0">Entry</span>
                                  <span className="text-white text-xs font-semibold text-right break-all" data-testid={`entry-${trade.id}`}>{formatCurrency(trade.price)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-400 flex-shrink-0">SL</span>
                                  <span className="text-white text-xs font-semibold text-right break-all" data-testid={`sl-${trade.id}`}>{formatCurrency(trade.stopLossTrigger)}</span>
                                </div>
                                {trade.leverage && (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-400 flex-shrink-0">Lev</span>
                                    <span className="text-white text-xs font-semibold text-right" data-testid={`leverage-${trade.id}`}>{trade.leverage}x</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* BOTTOM SECTION (20% height) - Targets with Safebook logic */}
                          <div className="h-[32px] bg-slate-800/80 backdrop-blur-sm border-t border-slate-700/50">
                            <div className="flex h-full items-center px-3 gap-3 overflow-x-auto">
                              {/* Show Safebook instead of T1 when safebook is completed */}
                              {trade.completionReason === 'safe_book' && trade.safebookPrice ? (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-xs text-gray-400">Safe Book:</span>
                                  <span className="text-xs text-green-400 font-medium" data-testid={`safebook-${trade.id}`}>
                                    {formatCurrency(trade.safebookPrice)}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-xs text-gray-400">T1:</span>
                                  <span className="text-xs text-green-400 font-medium" data-testid={`t1-${trade.id}`}>
                                    {formatCurrency(trade.takeProfitTrigger)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-xs text-gray-400">T2:</span>
                                <span className="text-xs text-green-400 font-medium" data-testid={`t2-${trade.id}`}>
                                  {formatCurrency(trade.takeProfit2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-xs text-gray-400">T3:</span>
                                <span className="text-xs text-green-400 font-medium" data-testid={`t3-${trade.id}`}>
                                  {formatCurrency(trade.takeProfit3)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trades for this date - Desktop: Grid Layout */}
              <div className="hidden md:grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupedTrades[dateKey].map((trade) => (
                  <Card key={trade.id} className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 rounded-lg overflow-hidden" data-testid={`trade-card-${trade.id}`}>

                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-start justify-between pr-6">
                        <div>
                          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {trade.pair}
                          </CardTitle>
                          <Badge 
                            className={`mt-1 px-2 py-0.5 text-[10px] font-medium ${
                              trade.type.toLowerCase() === 'buy' 
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
                                <TrendingDown className="w-3 h-3 text-slate-500" />
                              )}
                              <span className={`text-xs font-semibold ${
                                trade.gainLoss.isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
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
                      ${trade.price ? Number(trade.price).toLocaleString('en-IN') : 'N/A'}
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
                      ? 'bg-slate-100 border-slate-300 dark:bg-slate-700/50 dark:border-slate-600/50' 
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Stop Loss</span>
                      {trade.completionReason === 'stop_loss_hit' && (
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold text-slate-500">•</span>
                          <span className="text-xs">😰</span>
                        </div>
                      )}
                    </div>
                    <p className={`font-semibold text-xs mt-0.5 ${
                      trade.completionReason === 'stop_loss_hit' 
                        ? 'text-slate-600 dark:text-slate-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`} data-testid={`text-stop-loss-${trade.id}`}>
                      ${Number(trade.stopLossTrigger).toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                {/* Take Profits in compact boxes */}
                {(trade.takeProfitTrigger || trade.takeProfit2 || trade.takeProfit3 || (trade.completionReason === 'safe_book' && trade.safebookPrice)) && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">Targets</p>
                    <div className="flex gap-1">
                      {/* Show Safebook FIRST when completion reason is safe_book */}
                      {trade.completionReason === 'safe_book' && trade.safebookPrice && (
                        <div className="flex-1 p-1.5 rounded border transition-all bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Safebook</span>
                            <div className="flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                              <span className="text-xs">🎉</span>
                            </div>
                          </div>
                          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300" data-testid={`text-safebook-${trade.id}`}>
                            ${Number(trade.safebookPrice).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}
                      
                      {trade.takeProfitTrigger && (
                        <div className={`flex-1 p-1.5 rounded border transition-all ${
                          trade.completionReason === 'target_1_hit' 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' 
                            : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                        }`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">T1</span>
                            {trade.completionReason === 'target_1_hit' && (
                              <div className="flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                                <span className="text-xs">🎉</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit1-${trade.id}`}>
                            ${Number(trade.takeProfitTrigger).toLocaleString('en-IN')}
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
                              <div className="flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                                <span className="text-xs">🎉</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit2-${trade.id}`}>
                            ${Number(trade.takeProfit2).toLocaleString('en-IN')}
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
                              <div className="flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
                                <span className="text-xs">🎉</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300" data-testid={`text-take-profit3-${trade.id}`}>
                            ${Number(trade.takeProfit3).toLocaleString('en-IN')}
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
                  {trade.createdAt 
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