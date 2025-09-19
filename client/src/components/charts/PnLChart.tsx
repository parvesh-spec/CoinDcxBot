import { useMemo } from 'react';
import type { Trade } from '@shared/schema';
import { calculatePortfolioPnL, getPnLColorIntensity, type PnLData } from '@/utils/pnlCalculator';
import { TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';

interface PnLChartProps {
  trades: Trade[];
  className?: string;
}

export function PnLChart({ trades, className = '' }: PnLChartProps) {
  const portfolioData = useMemo(() => {
    return calculatePortfolioPnL(trades);
  }, [trades]);

  const { pnlData, totalPnL, totalPnLPercentage, winRate, profitableTrades, totalTrades } = portfolioData;

  // Group trades by date for heat map visualization
  const tradesByDate = useMemo(() => {
    const grouped = new Map<string, PnLData[]>();
    
    pnlData.forEach(trade => {
      const dateKey = trade.date.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(trade);
    });

    return Array.from(grouped.entries())
      .map(([date, trades]) => ({
        date,
        trades,
        dailyPnL: trades.reduce((sum, trade) => sum + trade.pnlAmount, 0),
        dailyPnLPercentage: trades.reduce((sum, trade) => sum + trade.pnlPercentage, 0) / trades.length,
        tradeCount: trades.length,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30); // Show last 30 days
  }, [pnlData]);

  // Get completion reason icon
  const getCompletionIcon = (reason: string) => {
    switch (reason) {
      case 'stop_loss_hit':
        return <AlertTriangle className="w-3 h-3" />;
      case 'target_1_hit':
      case 'target_2_hit': 
      case 'target_3_hit':
        return <Target className="w-3 h-3" />;
      case 'safe_book':
        return <TrendingUp className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (totalTrades === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-lg p-6 ${className}`}>
        <div className="text-center text-slate-500 dark:text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No completed trades available for P&L analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-6 ${className}`} data-testid="pnl-chart">
      {/* Header Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200" data-testid="pnl-title">
            P&L Analysis
          </h2>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Last {tradesByDate.length} days
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4" data-testid="total-pnl">
            <div className="text-sm text-slate-500 dark:text-slate-400">Total P&L</div>
            <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
            <div className={`text-xs ${totalPnLPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnLPercentage >= 0 ? '+' : ''}{totalPnLPercentage.toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4" data-testid="win-rate">
            <div className="text-sm text-slate-500 dark:text-slate-400">Win Rate</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">
              {profitableTrades}/{totalTrades} trades
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4" data-testid="total-trades">
            <div className="text-sm text-slate-500 dark:text-slate-400">Total Trades</div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {totalTrades}
            </div>
            <div className="text-xs text-green-500">
              {profitableTrades} profitable
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4" data-testid="avg-trade">
            <div className="text-sm text-slate-500 dark:text-slate-400">Avg Trade</div>
            <div className={`text-lg font-bold ${(totalPnL / totalTrades) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              ${(totalPnL / totalTrades).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Daily P&L Heat Map */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3" data-testid="heatmap-title">
          Daily P&L Heat Map
        </h3>
        <div className="grid grid-cols-7 md:grid-cols-10 lg:grid-cols-15 gap-1">
          {tradesByDate.map(({ date, dailyPnL, dailyPnLPercentage, tradeCount }) => {
            const colorClass = getPnLColorIntensity(dailyPnLPercentage);
            const dateObj = new Date(date);
            
            return (
              <div
                key={date}
                className={`${colorClass} rounded aspect-square flex items-center justify-center text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:opacity-80 transition-opacity`}
                title={`${dateObj.toLocaleDateString()}: ${dailyPnL >= 0 ? '+' : ''}$${dailyPnL.toFixed(2)} (${tradeCount} trades)`}
                data-testid={`heatmap-${date}`}
              >
                {dateObj.getDate()}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Less</span>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="w-3 h-3 bg-red-200 dark:bg-red-900 rounded"></div>
            <div className="w-3 h-3 bg-red-400 dark:bg-red-700 rounded"></div>
            <div className="w-3 h-3 bg-green-400 dark:bg-green-700 rounded"></div>
            <div className="w-3 h-3 bg-green-600 dark:bg-green-500 rounded"></div>
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Recent Trades List */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3" data-testid="recent-trades-title">
          Recent Completed Trades
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pnlData.slice(0, 10).map((trade) => (
            <div
              key={trade.tradeId}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
              data-testid={`trade-pnl-${trade.tradeId}`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1 rounded ${trade.isProfit ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'}`}>
                  {getCompletionIcon(trade.completionReason)}
                </div>
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {trade.pair}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ${trade.entryPrice.toFixed(4)} → ${trade.exitPrice.toFixed(4)}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-bold ${trade.isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {trade.isProfit ? '+' : ''}${trade.pnlAmount.toFixed(2)}
                </div>
                <div className={`text-xs ${trade.isProfit ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.isProfit ? '+' : ''}{trade.pnlPercentage.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}