import { useMemo } from 'react';
import type { Trade } from '@shared/schema';

interface MonthlyOutcomeCalendarProps {
  trades: Trade[];
  className?: string;
}

interface DayOutcome {
  date: number;
  hasWin: boolean;
  hasLoss: boolean;
  isEmpty: boolean;
}

export function MonthlyOutcomeCalendar({ trades, className = '' }: MonthlyOutcomeCalendarProps) {
  // Get current date info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Get first day of month and total days
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const totalDays = lastDay.getDate();
  const startDay = firstDay.getDay(); // 0 = Sunday
  
  // Get month name
  const monthName = firstDay.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Process trades to get daily outcomes
  const dailyOutcomes = useMemo(() => {
    const outcomes: Record<number, DayOutcome> = {};
    
    // Initialize all days as empty
    for (let i = 1; i <= totalDays; i++) {
      outcomes[i] = {
        date: i,
        hasWin: false,
        hasLoss: false,
        isEmpty: true
      };
    }
    
    // Process completed trades for current month
    trades.forEach(trade => {
      if (trade.status !== 'completed' || !trade.completionReason) return;
      
      const tradeDate = new Date(trade.updatedAt || trade.createdAt || new Date());
      
      // Check if trade is from current month/year
      if (tradeDate.getFullYear() === currentYear && tradeDate.getMonth() === currentMonth) {
        const dayOfMonth = tradeDate.getDate();
        
        if (outcomes[dayOfMonth]) {
          outcomes[dayOfMonth].isEmpty = false;
          
          // Determine if win or loss based on completion reason
          if (trade.completionReason === 'stop_loss_hit') {
            outcomes[dayOfMonth].hasLoss = true;
          } else {
            // All other completion reasons (target_1/2/3_hit, safe_book, or any other) are wins
            outcomes[dayOfMonth].hasWin = true;
          }
        }
      }
    });
    
    return outcomes;
  }, [trades, currentYear, currentMonth, totalDays]);

  // Get color for a day based on outcome
  const getDayColor = (outcome: DayOutcome) => {
    if (outcome.isEmpty) {
      return 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500';
    }
    
    // If has loss, show red (loss takes precedence)
    if (outcome.hasLoss) {
      return 'bg-red-400 dark:bg-red-600 text-white';
    }
    
    // If has win and no loss, show green
    if (outcome.hasWin) {
      return 'bg-green-400 dark:bg-green-600 text-white';
    }
    
    // Fallback (shouldn't happen if isEmpty is false)
    return 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300';
  };

  // Create calendar grid
  const calendarDays = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(
      <div key={`empty-${i}`} className="aspect-square"></div>
    );
  }
  
  // Add actual days
  for (let day = 1; day <= totalDays; day++) {
    const outcome = dailyOutcomes[day];
    const colorClass = getDayColor(outcome);
    const isToday = day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
    
    calendarDays.push(
      <div
        key={day}
        className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium cursor-pointer transition-all hover:opacity-80 ${colorClass} ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
        title={
          outcome.isEmpty 
            ? `${day} - No trades` 
            : `${day} - ${outcome.hasLoss ? 'Loss' : 'Win'} trades`
        }
        data-testid={`calendar-day-${day}`}
      >
        {day}
      </div>
    );
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-6 ${className}`} data-testid="monthly-calendar">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200" data-testid="calendar-title">
          Trade Outcome Calendar
        </h3>
        <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
          {monthName}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-400 dark:bg-green-600 rounded"></div>
          <span className="text-slate-600 dark:text-slate-300">Winning Days</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-400 dark:bg-red-600 rounded"></div>
          <span className="text-slate-600 dark:text-slate-300">Loss Days</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-100 dark:bg-slate-700 rounded"></div>
          <span className="text-slate-600 dark:text-slate-300">No Trades</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-2">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays}
        </div>
      </div>
      
      {/* Note */}
      <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
        Current month view • {Object.values(dailyOutcomes).filter(d => !d.isEmpty).length} trading days this month
      </div>
    </div>
  );
}