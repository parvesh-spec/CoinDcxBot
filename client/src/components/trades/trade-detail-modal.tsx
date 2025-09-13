import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Select component no longer needed - completion reason auto-derived from target status
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCryptoPrice } from "@/lib/utils";

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
  completionReason?: string;
  notes?: string;
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
  // Completion reason is now auto-derived from target status - no manual selection needed

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/trades/${trade.id}/complete`, {
        // completionReason auto-derived from targetStatus in backend
      });
    },
    onSuccess: () => {
      // Invalidate all trade-related queries
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      
      // Force refetch to ensure immediate update
      queryClient.refetchQueries({ queryKey: ["trades"] });
      queryClient.refetchQueries({ queryKey: ["/api/trades/stats"] });
      
      toast({
        title: "Success",
        description: "Trade marked as completed",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete trade",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
            <i className="fas fa-play mr-1" />
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            <i className="fas fa-check mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCompletionReasonText = (reason: string) => {
    switch (reason) {
      case "stop_loss_hit":
        return "Stop Loss Hit";
      case "target_1_hit":
        return "Target 1 Hit";
      case "target_2_hit":
        return "Target 2 Hit";
      case "target_3_hit":
        return "Target 3 Hit";
      case "safebook_hit":
        return "Safebook Hit";
      default:
        return reason;
    }
  };

  const formatPrice = (price: string) => {
    return formatCryptoPrice(price, 'INR');
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

          {trade.completionReason && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Completion Reason</label>
              <p className="text-sm text-foreground" data-testid="text-completion-reason">
                {getCompletionReasonText(trade.completionReason)}
              </p>
            </div>
          )}

          {trade.notes && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <p className="text-sm text-foreground bg-muted p-2 rounded" data-testid="text-completion-notes">
                {trade.notes}
              </p>
            </div>
          )}

        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
          {trade.status === "active" && (
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid="button-mark-complete"
            >
              {completeMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  Completing...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2" />
                  Mark as Complete
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
