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
  
  if (trade.type === 'buy') {
    // Long position: profit when exit > entry
    pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    // Short position: profit when exit < entry  
    pnlPercentage = ((entryPrice - exitPrice) / entryPrice) * 100;
  }

  // Apply leverage
  return pnlPercentage * (trade.leverage || 1);
}

export function YearlyPnLHeatmap({ trades, className = '' }: YearlyPnLHeatmapProps) {
  // Process trades to get daily P&L data for the year
  const yearlyData = useMemo(() => {
    const dailyData = new Map<string, DayData>();
    const currentYear = new Date().getFullYear();
    
    // Initialize all days of the year
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dailyData.set(dateKey, {
        date: new Date(d),
        totalPnLPercentage: 0,
        tradeCount: 0,
      });
    }
    
    // Process trades and accumulate P&L by date
    trades.forEach(trade => {
      const tradeDate = new Date(trade.updatedAt || trade.createdAt || new Date());
      
      // Only process trades from current year
      if (tradeDate.getFullYear() === currentYear) {
        const dateKey = tradeDate.toISOString().split('T')[0];
        const dayData = dailyData.get(dateKey);
        
        if (dayData) {
          const tradePnL = calculateTradePnLPercentage(trade);
          dayData.totalPnLPercentage += tradePnL;
          dayData.tradeCount += 1;
        }
      }
    });
    
    // Convert to array and create weeks
    const daysArray = Array.from(dailyData.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Group into weeks for GitHub-style layout
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];
    
    // Add empty days at the beginning if year doesn't start on Sunday
    const firstDay = daysArray[0];
    const startDayOfWeek = firstDay.date.getDay(); // 0 = Sunday
    
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({
        date: new Date(0), // Placeholder
        totalPnLPercentage: 0,
        tradeCount: 0,
      });
    }
    
    daysArray.forEach((day, index) => {
      currentWeek.push(day);
      
      // If it's Saturday (6) or last day, complete the week
      if (day.date.getDay() === 6 || index === daysArray.length - 1) {
        // Fill rest of week if needed
        while (currentWeek.length < 7) {
          currentWeek.push({
            date: new Date(0), // Placeholder
            totalPnLPercentage: 0,
            tradeCount: 0,
          });
        }
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  }, [trades]);

  // Get color for a day based on P&L
  const getDayColor = (day: DayData) => {
    if (day.date.getTime() === 0) {
      // Placeholder day
      return 'bg-transparent';
    }
    
    if (day.tradeCount === 0) {
      return 'bg-slate-100 dark:bg-slate-800';
    }
    
    const pnl = day.totalPnLPercentage;
    
    if (pnl > 0) {
      // Green for profit - intensity based on magnitude
      if (pnl < 5) return 'bg-green-200 dark:bg-green-900';
      if (pnl < 15) return 'bg-green-300 dark:bg-green-800';
      if (pnl < 30) return 'bg-green-400 dark:bg-green-700';
      return 'bg-green-500 dark:bg-green-600';
    } else if (pnl < 0) {
      // Red for loss - intensity based on magnitude
      const absPnl = Math.abs(pnl);
      if (absPnl < 5) return 'bg-red-200 dark:bg-red-900';
      if (absPnl < 15) return 'bg-red-300 dark:bg-red-800';
      if (absPnl < 30) return 'bg-red-400 dark:bg-red-700';
      return 'bg-red-500 dark:bg-red-600';
    } else {
      // Neutral (exactly 0%)
      return 'bg-slate-300 dark:bg-slate-600';
    }
  };

  const getTooltipText = (day: DayData) => {
    if (day.date.getTime() === 0 || day.tradeCount === 0) {
      return '';
    }
    
    const dateStr = day.date.toLocaleDateString();
    const pnlSign = day.totalPnLPercentage >= 0 ? '+' : '';
    return `${dateStr}: ${pnlSign}${day.totalPnLPercentage.toFixed(1)}% (${day.tradeCount} trades)`;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 ${className}`} data-testid="yearly-pnl-heatmap">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {new Date().getFullYear()} Trading Activity
        </h3>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-200 dark:bg-green-900 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-400 dark:bg-green-700 rounded-sm"></div>
            <div className="w-2 h-2 bg-green-500 dark:bg-green-600 rounded-sm"></div>
          </div>
          <span>More</span>
        </div>
      </div>
      
      {/* Heatmap Grid */}
      <div className="flex gap-1 overflow-x-auto">
        {yearlyData.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`w-2 h-2 rounded-sm ${getDayColor(day)} cursor-pointer hover:opacity-80 transition-opacity`}
                title={getTooltipText(day)}
                data-testid={day.date.getTime() === 0 ? 'empty-day' : `heatmap-${day.date.toISOString().split('T')[0]}`}
              />
            ))}
          </div>
        ))}
      </div>
      
      {/* Compact Stats */}
      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
        {trades.filter(t => t.status === 'completed').length} completed trades this year
      </div>
    </div>
  );
}