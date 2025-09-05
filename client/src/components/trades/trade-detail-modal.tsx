import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Trade {
  id: string;
  tradeId: string;
  pair: string;
  type: string;
  price: string;
  quantity: string;
  total: string;
  fee?: string;
  status: string;
  createdAt: string;
  errorMessage?: string;
  channel?: {
    name: string;
  };
}

interface TradeDetailModalProps {
  trade: Trade;
  isOpen: boolean;
  onClose: () => void;
}

export default function TradeDetailModal({
  trade,
  isOpen,
  onClose,
}: TradeDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/trades/${trade.id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({
        title: "Success",
        description: "Trade queued for retry",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to retry trade",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            Posted
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            Pending
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(parseFloat(price));
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trade Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Trade ID</label>
              <p className="text-sm text-foreground" data-testid="text-trade-id">{trade.tradeId}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                {getStatusBadge(trade.status)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pair</label>
              <p className="text-sm text-foreground" data-testid="text-trade-pair">{trade.pair}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <p className="text-sm text-foreground" data-testid="text-trade-type">{trade.type.toUpperCase()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Price</label>
              <p className="text-sm text-foreground" data-testid="text-trade-price">{formatPrice(trade.price)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <p className="text-sm text-foreground" data-testid="text-trade-quantity">{trade.quantity}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Total</label>
              <p className="text-sm text-foreground" data-testid="text-trade-total">{formatPrice(trade.total)}</p>
            </div>
            {trade.fee && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fee</label>
                <p className="text-sm text-foreground" data-testid="text-trade-fee">{formatPrice(trade.fee)}</p>
              </div>
            )}
          </div>

          {trade.channel && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Channel</label>
              <p className="text-sm text-foreground" data-testid="text-trade-channel">{trade.channel.name}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Time</label>
            <p className="text-sm text-foreground" data-testid="text-trade-time">{formatTime(trade.createdAt)}</p>
          </div>

          {trade.errorMessage && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Error Message</label>
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded" data-testid="text-error-message">
                {trade.errorMessage}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
          {trade.status === "failed" && (
            <Button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              data-testid="button-retry-post"
            >
              {retryMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  Retrying...
                </>
              ) : (
                <>
                  <i className="fas fa-redo mr-2" />
                  Retry Post
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
