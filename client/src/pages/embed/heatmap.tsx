import { useQuery } from "@tanstack/react-query";
import { HeatmapWidget } from '@/components/embed/HeatmapWidget';
import type { Trade } from '@shared/schema';

interface TradeHistoryResponse {
  trades: Trade[];
  total: number;
}

export default function EmbedHeatmapPage() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const scale = parseFloat(urlParams.get('scale') || '1.0');
  const theme = urlParams.get('theme') as 'light' | 'dark' || 'light';
  const clickTarget = urlParams.get('clickTarget') || window.location.origin + '/trade-history';

  // Fetch public trade data
  const { data, isLoading, error } = useQuery<TradeHistoryResponse>({
    queryKey: ["/api/public/trades/completed"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className={`${theme === 'dark' ? 'dark' : ''} bg-white dark:bg-slate-900 min-h-screen flex items-center justify-center`}>
        <div className="animate-pulse">
          <div className="bg-slate-200 dark:bg-slate-700 rounded-lg p-8">
            Loading trading data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme === 'dark' ? 'dark' : ''} bg-white dark:bg-slate-900 min-h-screen flex items-center justify-center`}>
        <div className="text-red-500 text-center">
          <div className="text-lg font-semibold">Failed to load trading data</div>
          <div className="text-sm mt-2">Please try again later</div>
        </div>
      </div>
    );
  }

  const { trades = [] } = data || {};

  return (
    <HeatmapWidget 
      trades={trades}
      scale={scale}
      clickTarget={clickTarget}
      theme={theme}
    />
  );
}