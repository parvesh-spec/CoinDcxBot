import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Send, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Automation, SentMessage } from "@shared/schema";
import AddAutomationModal from "@/components/automation/add-automation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Extended types with relations for API responses
interface AutomationWithRelations extends Automation {
  channel?: {
    name: string;
  };
  template?: {
    name: string;
  };
}

interface SentMessageWithRelations extends SentMessage {
  automation?: {
    name: string;
  };
  trade?: {
    pair: string;
    type: string;
  };
  channel?: {
    name: string;
  };
}

export default function AutomationPage() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMessage, setViewMessage] = useState<{text: string, title: string} | null>(null);

  // Fetch automations
  const { data: automations = [], isLoading: automationsLoading } = useQuery<AutomationWithRelations[]>({
    queryKey: ["/api/automations"],
  });

  // Fetch sent messages history
  const { data: sentMessages = [], isLoading: messagesLoading } = useQuery<SentMessageWithRelations[]>({
    queryKey: ["/api/sent-messages"],
  });

  const getTriggerBadge = (triggerType: string) => {
    switch (triggerType) {
      case "trade_registered":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
            Trade Registered
          </Badge>
        );
      case "trade_completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            Trade Completed
          </Badge>
        );
      default:
        return <Badge variant="outline">{triggerType}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
            <Send className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Automation</h1>
          <p className="text-muted-foreground">
            Manage automated Telegram messaging for trade notifications
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center"
          data-testid="button-add-automation"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Automation
        </Button>
      </div>

      {/* Active Automations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Active Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {automationsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : automations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No automations configured yet</p>
              <Button
                onClick={() => setShowAddModal(true)}
                variant="outline"
                className="mt-4"
                data-testid="button-create-first-automation"
              >
                Create Your First Automation
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`automation-${automation.id}`}
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{automation.name}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <span>Channel: {automation.channel?.name || "Unknown"}</span>
                      <span>•</span>
                      <span>Template: {automation.template?.name || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getTriggerBadge(automation.triggerType)}
                    <Badge 
                      variant={automation.isActive ? "default" : "secondary"}
                      data-testid={`status-${automation.id}`}
                    >
                      {automation.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Message History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messagesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sentMessages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No messages sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border" data-testid="table-message-history">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Automation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Trade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Sent At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {sentMessages.map((message) => (
                    <tr key={message.id} data-testid={`message-row-${message.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {message.automation?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {message.trade ? `${message.trade.pair} (${message.trade.type.toUpperCase()})` : "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {message.channel?.name || message.channelId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(message.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {message.sentAt ? formatDistanceToNow(new Date(message.sentAt), { addSuffix: true }) : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {message.messageText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMessage({
                              text: message.messageText || '',
                              title: `Message to ${message.channel?.name || 'Channel'}`
                            })}
                            data-testid={`button-view-message-${message.id}`}
                            className="hover:bg-muted"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Automation Modal */}
      <AddAutomationModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
      
      {/* View Message Dialog */}
      <Dialog open={!!viewMessage} onOpenChange={() => setViewMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewMessage?.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                {viewMessage?.text}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}