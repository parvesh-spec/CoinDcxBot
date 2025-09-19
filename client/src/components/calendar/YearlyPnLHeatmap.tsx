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

  // Calculate P&L percentage based on trade type (fixed case-sensitive issue)
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

// Seeded random function for consistent mock data
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate consistent seed from date
function getDateSeed(date: Date): number {
  return date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
}

export function YearlyPnLHeatmap({ trades, className = '' }: YearlyPnLHeatmapProps) {
  const monthlyData = useMemo(() => {
    // Trading season: September 2025 to August 2026
    const startYear = 2025;
    const endYear = 2026;
    
    // Pre-index trades by local date for better performance
    const tradesByDate = new Map<string, Trade[]>();
    trades.forEach(trade => {
      if (trade.status === 'completed') {
        const tradeDate = new Date(trade.createdAt || new Date());
        const tradeYear = tradeDate.getFullYear();
        const tradeMonth = tradeDate.getMonth(); // 0-11
        
        // Check if trade is in Apr 2025 - Mar 2026 season
        const isInSeason = (
          (tradeYear === startYear && tradeMonth >= 3) || // Apr-Dec 2025 (month 3-11)
          (tradeYear === endYear && tradeMonth <= 2)     // Jan-Mar 2026 (month 0-2)
        );
        
        if (isInSeason) {
          const dateKey = getLocalDateKey(tradeDate);
          if (!tradesByDate.has(dateKey)) {
            tradesByDate.set(dateKey, []);
          }
          tradesByDate.get(dateKey)!.push(trade);
        }
      }
    });
    
    const months: {
      name: string;
      days: DayData[];
      monthIndex: number;
    }[] = [];
    
    // Create data for trading season: April 2025 - March 2026
    const seasonMonths = [
      // Apr-Aug 2025 (mock data period)
      { year: startYear, month: 3 },  // April 2025
      { year: startYear, month: 4 },  // May 2025
      { year: startYear, month: 5 },  // June 2025
      { year: startYear, month: 6 },  // July 2025
      { year: startYear, month: 7 },  // August 2025
      // Sept-Dec 2025 (real data)
      { year: startYear, month: 8 },  // September 2025
      { year: startYear, month: 9 },  // October 2025
      { year: startYear, month: 10 }, // November 2025
      { year: startYear, month: 11 }, // December 2025
      // Jan-Mar 2026
      { year: endYear, month: 0 },    // January 2026
      { year: endYear, month: 1 },    // February 2026
      { year: endYear, month: 2 },    // March 2026
    ];
    
    seasonMonths.forEach(({ year, month: monthIndex }, index) => {
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);
      const daysInMonth = monthEnd.getDate();
      const monthName = monthStart.toLocaleDateString('en', { month: 'short' }).toUpperCase();
      
      const monthDays: DayData[] = [];
      
      // Create daily data for the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthIndex, day);
        const dateKey = getLocalDateKey(date);
        
        // Check if this is mock data period (April-August 2025)
        const isMockDataPeriod = year === startYear && monthIndex >= 3 && monthIndex <= 7;
        
        if (isMockDataPeriod) {
          // Generate mock data for April-August 2025
          // Skip weekends (Saturday=6, Sunday=0) for realistic trading
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (isWeekend) {
            // No trading on weekends
            monthDays.push({
              date,
              totalPnLPercentage: 0,
              tradeCount: 0,
              isCurrentMonth: true,
            });
          } else {
            // Generate consistent trading day using date-based seed
            const seed = getDateSeed(date);
            const random = seededRandom(seed);
            
            if (random < 0.15) {
              // 15% chance: No trade day
              monthDays.push({
                date,
                totalPnLPercentage: 0,
                tradeCount: 0,
                isCurrentMonth: true,
              });
            } else if (random < 0.85) {
              // 70% chance: Profit day (80% of trading days)
              const profitPnL = seededRandom(seed + 1) * 50 + 10; // 10-60% profit
              monthDays.push({
                date,
                totalPnLPercentage: profitPnL,
                tradeCount: Math.floor(seededRandom(seed + 2) * 3) + 1, // 1-3 trades
                isCurrentMonth: true,
              });
            } else {
              // 15% chance: Loss day (20% of trading days)
              const lossPnL = -(seededRandom(seed + 3) * 30 + 5); // -5% to -35% loss
              monthDays.push({
                date,
                totalPnLPercentage: lossPnL,
                tradeCount: Math.floor(seededRandom(seed + 4) * 2) + 1, // 1-2 trades
                isCurrentMonth: true,
              });
            }
          }
        } else {
          // Real data period (September onwards)
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
      }
      
      // No weeks layout - just use actual days
      
      months.push({
        name: monthName,
        days: monthDays, // Just actual days, no weeks
        monthIndex: index, // Use sequential index for display
      });
    });
    
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
          2025 Trading P&L Heatmap
        </h3>
      </div>
      
      {/* Monthly Heatmap Grid */}
      <div className="grid grid-cols-6 gap-2">
        {monthlyData.map((month) => (
          <div key={month.monthIndex} className="flex flex-col items-center">
            {/* Month Grid - Flow layout for actual days only */}
            <div className="flex flex-wrap gap-0.5 mb-2 justify-center max-w-[120px]">
              {month.days.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-sm border border-slate-300 dark:border-slate-600 ${getDayColor(day)} cursor-pointer hover:opacity-80 transition-opacity`}
                  title={getTooltipText(day)}
                  data-testid={`heatmap-${getLocalDateKey(day.date)}`}
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
          return count + month.days.filter(day => 
            day.tradeCount > 0 && day.totalPnLPercentage > 0
          ).length;
        }, 0)} profitable days
      </div>
    </div>
  );
}