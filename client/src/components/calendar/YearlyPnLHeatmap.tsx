import { useMemo } from 'react';
import type { Trade } from '@shared/schema';

interface YearlyPnLHeatmapProps {
  trades: Trade[];
  className?: string;
}

interface DayData {
  date: Date;
  totalPnLPercentage: number;
  tradeCount: number;
  isCurrentMonth: boolean;
}

// Calculate P&L percentage for a single trade
function calculateTradePnLPercentage(trade: Trade): number {
  if (trade.status !== 'completed' || !trade.completionReason) {
    return 0;
  }

  const entryPrice = parseFloat(trade.price);
  let exitPrice: number;
  
  // Determine exit price based on completion reason
  switch (trade.completionReason) {
    case 'stop_loss_hit':
      exitPrice = parseFloat(trade.stopLossTrigger || '0');
      break;
    case 'target_1_hit':
      exitPrice = parseFloat(trade.takeProfitTrigger || '0');
      break;
    case 'target_2_hit':
      exitPrice = parseFloat(trade.takeProfit2 || '0');
      break;
    case 'target_3_hit':
      exitPrice = parseFloat(trade.takeProfit3 || '0');
      break;
    case 'safe_book':
      exitPrice = parseFloat(trade.safebookPrice || '0');
      break;
    default:
      return 0;
  }

  if (exitPrice === 0 || entryPrice === 0) {
    return 0;
  }

  // Calculate P&L percentage based on trade type
  let pnlPercentage: number;
  
  if (trade.type.toLowerCase() === 'buy') {
    // Long position: profit when exit > entry
    pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    // Short position: profit when exit < entry  
    pnlPercentage = ((entryPrice - exitPrice) / entryPrice) * 100;
  }

  // Apply leverage
  return pnlPercentage * (trade.leverage || 1);
}

// Helper function to create local date key
function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function YearlyPnLHeatmap({ trades, className = '' }: YearlyPnLHeatmapProps) {
  const monthlyData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    // Pre-index trades by local date for better performance
    const tradesByDate = new Map<string, Trade[]>();
    trades.forEach(trade => {
      if (trade.status === 'completed') {
        const tradeDate = new Date(trade.createdAt || new Date());
        if (tradeDate.getFullYear() === currentYear) {
          const dateKey = getLocalDateKey(tradeDate);
          if (!tradesByDate.has(dateKey)) {
            tradesByDate.set(dateKey, []);
          }
          tradesByDate.get(dateKey)!.push(trade);
        }
      }
    });
    
    const months = [];
    
    // Create data for 12 months
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthStart = new Date(currentYear, monthIndex, 1);
      const monthEnd = new Date(currentYear, monthIndex + 1, 0);
      const daysInMonth = monthEnd.getDate();
      const monthName = monthStart.toLocaleDateString('en', { month: 'short' }).toUpperCase();
      
      const monthDays: DayData[] = [];
      
      // Create daily data for the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, monthIndex, day);
        const dateKey = getLocalDateKey(date);
        
        // Get trades for this date from pre-indexed map
        const dayTrades = tradesByDate.get(dateKey) || [];
        
        // Calculate total P&L for the day
        let totalPnL = 0;
        dayTrades.forEach(trade => {
          totalPnL += calculateTradePnLPercentage(trade);
        });
        
        monthDays.push({
          date,
          totalPnLPercentage: totalPnL,
          tradeCount: dayTrades.length,
          isCurrentMonth: true,
        });
      }
      
      // Organize days into weeks (rows of 7)
      const weeks: DayData[][] = [];
      const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday
      
      let currentWeek: DayData[] = [];
      
      // Add empty days for the beginning of first week
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push({
          date: new Date(0),
          totalPnLPercentage: 0,
          tradeCount: 0,
          isCurrentMonth: false,
        });
      }
      
      // Add actual days
      monthDays.forEach(day => {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      });
      
      // Fill the last week if needed
      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push({
            date: new Date(0),
            totalPnLPercentage: 0,
            tradeCount: 0,
            isCurrentMonth: false,
          });
        }
        weeks.push(currentWeek);
      }
      
      months.push({
        name: monthName,
        weeks,
        monthIndex,
      });
    }
    
    return months;
  }, [trades]);

  // Get color for a day based on P&L (Only 3 colors: green, red, no-trade)
  const getDayColor = (day: DayData) => {
    if (!day.isCurrentMonth) {
      return 'bg-slate-100 dark:bg-slate-800'; // Show empty days as gray
    }
    
    if (day.tradeCount === 0) {
      return 'bg-slate-100 dark:bg-slate-800'; // No trade days - gray
    }
    
    const pnl = day.totalPnLPercentage;
    
    if (pnl > 0) {
      return 'bg-green-500 dark:bg-green-600'; // Profit - green
    } else if (pnl < 0) {
      return 'bg-red-500 dark:bg-red-600'; // Loss - red
    } else {
      return 'bg-slate-300 dark:bg-slate-600'; // Exactly 0% - gray
    }
  };

  const getTooltipText = (day: DayData) => {
    if (!day.isCurrentMonth) {
      return '';
    }
    
    const dateStr = day.date.toLocaleDateString();
    
    if (day.tradeCount === 0) {
      return `${dateStr}: No trades`;
    }
    
    const pnlSign = day.totalPnLPercentage >= 0 ? '+' : '';
    return `${dateStr}: ${pnlSign}${day.totalPnLPercentage.toFixed(2)}% (${day.tradeCount} trades)`;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 ${className}`} data-testid="yearly-pnl-heatmap">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {new Date().getFullYear()} Trading P&L Heatmap
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-sm"></div>
            <div className="w-2 h-2 bg-red-200 dark:bg-red-900 rounded-sm"></div>
            <div className="w-2 h-2 bg-red-400 dark:bg-red-700 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-400 dark:bg-green-700 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-500 dark:bg-green-600 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>
      
      {/* Monthly Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {monthlyData.map((month) => (
          <div key={month.monthIndex} className="flex flex-col items-center">
            {/* Month Grid */}
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {month.weeks.flat().map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`w-3 h-3 rounded-sm ${getDayColor(day)} cursor-pointer hover:opacity-80 transition-opacity`}
                  title={getTooltipText(day)}
                  data-testid={day.isCurrentMonth ? `heatmap-${getLocalDateKey(day.date)}` : 'empty-day'}
                />
              ))}
            </div>
            
            {/* Month Label */}
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {month.name}
            </div>
          </div>
        ))}
      </div>
      
      {/* Stats */}
      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
        {trades.filter(t => t.status === 'completed').length} completed trades • 
        {monthlyData.reduce((count, month) => {
          return count + month.weeks.flat().filter(day => 
            day.isCurrentMonth && day.tradeCount > 0 && day.totalPnLPercentage > 0
          ).length;
        }, 0)} profitable days
      </div>
    </div>
  );
}