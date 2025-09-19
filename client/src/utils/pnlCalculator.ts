import type { Trade } from '@shared/schema';

export interface PnLData {
  tradeId: string;
  pair: string;
  entryPrice: number;
  exitPrice: number;
  pnlAmount: number;
  pnlPercentage: number;
  tradeValue: number;
  isProfit: boolean;
  completionReason: string;
  date: Date;
}

/**
 * Calculate P&L for a completed trade
 */
export function calculateTradePnL(trade: Trade): PnLData | null {
  // Only calculate for completed trades
  if (trade.status !== 'completed' || !trade.completionReason) {
    return null;
  }

  const entryPrice = parseFloat(trade.price);
  const tradeValue = parseFloat(trade.total);
  
  // Determine exit price based on completion reason
  let exitPrice: number;
  
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
      return null;
  }

  if (exitPrice === 0) {
    return null;
  }

  // Calculate P&L based on trade type
  let pnlPercentage: number;
  
  if (trade.type === 'buy') {
    // Long position: profit when exit > entry
    pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    // Short position: profit when exit < entry  
    pnlPercentage = ((entryPrice - exitPrice) / entryPrice) * 100;
  }

  // Apply leverage
  const leveragedPnL = pnlPercentage * (trade.leverage || 1);
  
  // Calculate absolute P&L amount
  const pnlAmount = (tradeValue * leveragedPnL) / 100;

  return {
    tradeId: trade.id,
    pair: trade.pair,
    entryPrice,
    exitPrice,
    pnlAmount,
    pnlPercentage: leveragedPnL,
    tradeValue,
    isProfit: leveragedPnL > 0,
    completionReason: trade.completionReason,
    date: new Date(trade.updatedAt || trade.createdAt || new Date()),
  };
}

/**
 * Calculate P&L data for multiple trades
 */
export function calculatePortfolioPnL(trades: Trade[]): {
  pnlData: PnLData[];
  totalPnL: number;
  totalPnLPercentage: number;
  winRate: number;
  profitableTrades: number;
  totalTrades: number;
} {
  const pnlData = trades
    .map(calculateTradePnL)
    .filter((data): data is PnLData => data !== null);

  const totalPnL = pnlData.reduce((sum, data) => sum + data.pnlAmount, 0);
  const totalTradeValue = pnlData.reduce((sum, data) => sum + data.tradeValue, 0);
  const totalPnLPercentage = totalTradeValue > 0 ? (totalPnL / totalTradeValue) * 100 : 0;
  
  const profitableTrades = pnlData.filter(data => data.isProfit).length;
  const totalTrades = pnlData.length;
  const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

  return {
    pnlData,
    totalPnL,
    totalPnLPercentage,
    winRate,
    profitableTrades,
    totalTrades,
  };
}

/**
 * Get color intensity based on P&L magnitude (Zerodha style)
 */
export function getPnLColorIntensity(pnlPercentage: number): string {
  const absPercentage = Math.abs(pnlPercentage);
  const isProfit = pnlPercentage > 0;
  
  if (absPercentage === 0) {
    return 'bg-slate-200 dark:bg-slate-700';
  }
  
  // Color intensity based on magnitude
  if (absPercentage < 1) {
    return isProfit ? 'bg-green-200 dark:bg-green-900' : 'bg-red-200 dark:bg-red-900';
  } else if (absPercentage < 5) {
    return isProfit ? 'bg-green-300 dark:bg-green-800' : 'bg-red-300 dark:bg-red-800';
  } else if (absPercentage < 10) {
    return isProfit ? 'bg-green-400 dark:bg-green-700' : 'bg-red-400 dark:bg-red-700';
  } else if (absPercentage < 20) {
    return isProfit ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500 dark:bg-red-600';
  } else {
    return isProfit ? 'bg-green-600 dark:bg-green-500' : 'bg-red-600 dark:bg-red-500';
  }
}