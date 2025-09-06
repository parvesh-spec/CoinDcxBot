import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Channel {
  id: string;
  name: string;
  channelId: string;
  description?: string;
  isActive: boolean;
  templateId?: string;
  templateName?: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
}

export default function ChannelsPage() {
  const { toast } = useToast();
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "",
    channelId: "",
    description: "",
  });

  // Fetch channels - use default query function that handles .json()
  const { data: channelsResponse = [], isLoading: channelsLoading, error: channelsError } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
  });
  
  // Ensure channels is always an array
  const channels = Array.isArray(channelsResponse) ? channelsResponse : [];

  // Fetch templates for dropdown - use default query function
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  // Ensure templates is always an array too
  const safeTemplates = Array.isArray(templates) ? templates : [];

  // Add channel mutation
  const addChannelMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/channels", data);
    },
    onSuccess: (data) => {
      console.log("Channel created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ["/api/channels"] });
      setNewChannel({ name: "", channelId: "", description: "" });
      setIsAddingChannel(false);
      toast({
        title: "Success",
        description: "Channel added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add channel",
        variant: "destructive",
      });
    },
  });

  // Toggle channel status
  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/channels/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({
        title: "Success",
        description: "Channel status updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update channel",
        variant: "destructive",
      });
    },
  });

  // Test message mutation
  const testMessageMutation = useMutation({
    mutationFn: async (channel: Channel) => {
      // Send test message to Telegram channel
      return await apiRequest("POST", `/api/channels/${channel.id}/test`, {
        message: `🔔 Test message from CoinDCX Bot\n\nChannel: ${channel.name}\nTime: ${new Date().toLocaleString()}\n\n✅ Connection successful!`
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test message sent successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send test message",
        variant: "destructive",
      });
    },
  });

  // Handle test message
  const handleTestMessage = (channel: Channel) => {
    testMessageMutation.mutate(channel);
  };


  const handleAddChannel = () => {
    if (!newChannel.name || !newChannel.channelId) {
      toast({
        title: "Validation Error",
        description: "Please fill in channel name and ID",
        variant: "destructive",
      });
      return;
    }

    addChannelMutation.mutate({
      name: newChannel.name,
      channelId: newChannel.channelId,
      description: newChannel.description,
      isActive: false,
    });
  };

  if (channelsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Channel Configuration</h1>
          <p className="text-muted-foreground">
            Manage Telegram channels for trade notifications
          </p>
        </div>
        <Button
          onClick={() => setIsAddingChannel(true)}
          data-testid="button-add-channel"
        >
          <i className="fas fa-plus mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Add Channel Form */}
      {isAddingChannel && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="channelName">Channel Name *</Label>
                <Input
                  id="channelName"
                  placeholder="e.g., Trading Signals"
                  value={newChannel.name}
                  onChange={(e) =>
                    setNewChannel((prev) => ({ ...prev, name: e.target.value }))
                  }
                  data-testid="input-channel-name"
                />
              </div>
              <div>
                <Label htmlFor="channelId">Channel ID *</Label>
                <Input
                  id="channelId"
                  placeholder="e.g., @trading_signals or -1001234567890"
                  value={newChannel.channelId}
                  onChange={(e) =>
                    setNewChannel((prev) => ({ ...prev, channelId: e.target.value }))
                  }
                  data-testid="input-channel-id"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="channelDescription">Description</Label>
              <Input
                id="channelDescription"
                placeholder="Optional description"
                value={newChannel.description}
                onChange={(e) =>
                  setNewChannel((prev) => ({ ...prev, description: e.target.value }))
                }
                data-testid="input-channel-description"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleAddChannel}
                disabled={addChannelMutation.isPending}
                data-testid="button-save-channel"
              >
                {addChannelMutation.isPending ? "Adding..." : "Add Channel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddingChannel(false)}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channels Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Active Channels ({Array.isArray(channels) ? channels.filter((c) => c.isActive).length : 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-comments text-4xl text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No channels configured
              </h3>
              <p className="text-muted-foreground mb-4">
                Add your first Telegram channel to start receiving trade notifications
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Test Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{channel.name}</div>
                        {channel.description && (
                          <div className="text-sm text-muted-foreground">
                            {channel.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {channel.channelId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={channel.isActive}
                          onCheckedChange={(checked) =>
                            toggleChannelMutation.mutate({
                              id: channel.id,
                              isActive: checked,
                            })
                          }
                          disabled={toggleChannelMutation.isPending}
                          data-testid={`toggle-${channel.id}`}
                        />
                        <Badge variant={channel.isActive ? "default" : "secondary"}>
                          {channel.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestMessage(channel)}
                        disabled={testMessageMutation.isPending}
                        data-testid={`button-test-${channel.id}`}
                      >
                        <i className="fas fa-paper-plane mr-2" />
                        Send Test
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}