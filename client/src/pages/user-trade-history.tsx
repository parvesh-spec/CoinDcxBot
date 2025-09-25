import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CopyTradingUser {
  id: string;
  name: string;
  email: string;
  exchange: string;
  riskPerTrade: string;
  tradeFund: string;
  maxTradesPerDay?: number;
  isActive: boolean;
  lowFund: boolean;
  futuresWalletBalance: string;
  notes?: string;
  createdAt: string;
}

interface CopyTrade {
  id: string;
  originalTradeId: string;
  copyUserId: string;
  executedTradeId?: string;
  pair: string;
  type: 'buy' | 'sell';
  originalPrice: string;
  executedPrice?: string;
  originalQuantity: string;
  executedQuantity?: string;
  stopLossPrice?: string;
  takeProfitPrice?: string;
  leverage: string;
  status: string;
  executionTime?: string;
  errorMessage?: string;
  pnl?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserTradeHistoryProps {
  copyTradingUser: CopyTradingUser;
  onBack: () => void;
}

export function UserTradeHistory({ copyTradingUser, onBack }: UserTradeHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data: tradesData, isLoading, error } = useQuery({
    queryKey: ['user-copy-trades', copyTradingUser.email, currentPage],
    queryFn: async () => {
      const response = await fetch(`/api/user-access/trades/${encodeURIComponent(copyTradingUser.email)}?page=${currentPage}&limit=${pageSize}`);
      if (!response.ok) {
        throw new Error('Failed to fetch copy trade history');
      }
      return response.json();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'buy' ? (
      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
    );
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const totalPages = tradesData?.total ? Math.ceil(tradesData.total / pageSize) : 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Campus for Wisdom branding */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white" data-testid="text-page-title">
                  Trade History
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-user-email">
                  {copyTradingUser.name || copyTradingUser.email}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400" data-testid="text-brand">
                Campus For Wisdom
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Trading Community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {error && (
          <Card className="mb-6 border-red-200 dark:border-red-800" data-testid="card-error">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <span className="text-sm">Failed to load trade history. Please try again.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade Statistics Summary */}
        {tradesData && !isLoading && (
          <Card className="mb-6" data-testid="card-stats">
            <CardHeader>
              <CardTitle className="text-lg">Trade Summary</CardTitle>
              <CardDescription>
                Your trading activity overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-trades">
                    {tradesData.total || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-completed-trades">
                    {tradesData.copyTrades?.filter((t: CopyTrade) => t.status === 'executed').length || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-recent-trades">
                    {tradesData.copyTrades?.filter((t: CopyTrade) => {
                      const tradeDate = new Date(t.createdAt);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return tradeDate > weekAgo;
                    }).length || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade List */}
        <Card data-testid="card-trades">
          <CardHeader>
            <CardTitle className="text-lg">Recent Trades</CardTitle>
            <CardDescription>
              Detailed view of your trading activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="text-right space-y-2">
                      <Skeleton className="h-4 w-16 ml-auto" />
                      <Skeleton className="h-3 w-20 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tradesData?.copyTrades?.length > 0 ? (
              <div className="space-y-4">
                {tradesData.copyTrades.map((trade: CopyTrade) => (
                  <div
                    key={trade.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all duration-200"
                    data-testid={`trade-item-${trade.id}`}
                  >
                    {/* Header Section */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${trade.type === 'buy' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
                          {getTypeIcon(trade.type)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`text-pair-${trade.id}`}>
                              {trade.pair}
                            </h3>
                            <Badge className={`text-xs font-medium uppercase ${trade.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'}`}>
                              {trade.type}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(trade.createdAt), 'MMM dd, HH:mm')}
                            </span>
                            <span>
                              {trade.leverage}x leverage
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`text-xs ${getStatusColor(trade.status)}`} data-testid={`badge-status-${trade.id}`}>
                        {trade.status}
                      </Badge>
                    </div>

                    {/* Trading Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {/* Entry Price */}
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Entry Price</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white" data-testid={`text-price-${trade.id}`}>
                          ${formatPrice(trade.executedPrice || trade.originalPrice)}
                        </p>
                      </div>

                      {/* Quantity */}
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Quantity</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white" data-testid={`text-quantity-${trade.id}`}>
                          {formatPrice(trade.executedQuantity || trade.originalQuantity)}
                        </p>
                      </div>

                      {/* Stop Loss */}
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stop Loss</p>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400" data-testid={`text-stop-loss-${trade.id}`}>
                          {trade.stopLossPrice ? `$${formatPrice(trade.stopLossPrice)}` : 'Not set'}
                        </p>
                      </div>

                      {/* Target */}
                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400" data-testid={`text-target-${trade.id}`}>
                          {trade.takeProfitPrice ? `$${formatPrice(trade.takeProfitPrice)}` : 'Not set'}
                        </p>
                      </div>
                    </div>

                    {/* Error Message for Failed Trades */}
                    {trade.status === 'failed' && trade.errorMessage && (
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg p-3">
                        <p className="text-xs text-red-600 dark:text-red-400" data-testid={`text-error-${trade.id}`}>
                          {trade.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12" data-testid="empty-state">
                <CheckCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No trades found</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  Your trade history will appear here once you start trading
                </p>
              </div>
            )}

            {/* Pagination */}
            {tradesData?.total > pageSize && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-pagination-info">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, tradesData.total)} of {tradesData.total} trades
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}