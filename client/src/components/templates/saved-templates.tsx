import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ChevronDown, ChevronUp, Edit2, Archive, Image, TestTube, Play } from "lucide-react";

interface SavedTemplatesProps {
  templates: any[];
  onTemplateSelect: (template: any) => void;
  onTemplateDeleted: () => void;
}

export default function SavedTemplates({
  templates,
  onTemplateSelect,
  onTemplateDeleted,
}: SavedTemplatesProps) {
  const { toast } = useToast();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [testDialogOpen, setTestDialogOpen] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("");

  const { data: channelsData } = useQuery({
    queryKey: ["/api/channels"],
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      onTemplateDeleted();
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ channelId, template }: { channelId: string; template: any }) => {
      const previewMessage = generatePreview(template.template);
      await apiRequest("POST", `/api/channels/${channelId}/test`, {
        message: previewMessage
      });
    },
    onSuccess: () => {
      setTestDialogOpen(null);
      setSelectedChannel("");
      toast({
        title: "Test Successful",
        description: "Template test message sent successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to send test message",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (template: string) => {
    try {
      await navigator.clipboard.writeText(template);
      toast({
        title: "Copied",
        description: "Template copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy template",
        variant: "destructive",
      });
    }
  };

  const extractVariables = (template: string) => {
    const variableRegex = /{(\w+)}/g;
    const variables = new Set<string>();
    let match;
    
    while ((match = variableRegex.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).sort();
  };

  const generatePreview = (template: string) => {
    let preview = template;

    // Sample data for preview
    const sampleData = {
      pair: "B-ETH_USDT",
      price: "₹4,285.67",
      type: "BUY",
      quantity: "50x",
      leverage: "50x",
      stopLoss: "₹4,200.00",
      takeProfit1: "₹4,350.00",
      takeProfit2: "₹4,415.00",
      takeProfit3: "₹4,480.00",
      timestamp: "Dec 15, 2024 14:32",
      profit_loss: "+₹5,234",
    };

    // Replace variables with sample data
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, "g");
      preview = preview.replace(regex, value);
    });

    return preview;
  };

  const toggleCard = (templateId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedCards(newExpanded);
  };

  const handleTestTemplate = (template: any) => {
    setTestDialogOpen(template.id);
    setSelectedChannel("");
  };

  const handleSendTest = () => {
    if (selectedChannel && testDialogOpen) {
      const template = templates.find(t => t.id === testDialogOpen);
      if (template) {
        testMutation.mutate({ channelId: selectedChannel, template });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved Templates</h2>
        <Badge variant="secondary">{templates.length} Templates</Badge>
      </div>
      
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Edit2 className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium mb-2">No templates found</p>
            <p className="text-sm">Create your first message template using the editor above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {templates.map((template) => {
            const isExpanded = expandedCards.has(template.id);
            const previewText = generatePreview(template.template);
            const truncatedPreview = previewText.length > 150 
              ? previewText.substring(0, 150) + "..." 
              : previewText;
            
            return (
              <Card key={template.id} className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-md hover:scale-[1.02]" data-testid={`template-item-${template.id}`}>
                <CardContent className="p-6">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 flex items-start gap-3">
                      {/* Image Thumbnail */}
                      {template.imageUrl ? (
                        <div className="flex-shrink-0">
                          <img
                            src={template.imageUrl}
                            alt={template.name}
                            className="w-12 h-12 rounded-md object-cover border border-border shadow-sm"
                            data-testid={`img-template-thumbnail-${template.id}`}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center">
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Template Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-foreground truncate">
                            {template.name}
                          </h3>
                          <Badge 
                            variant={template.isActive ? "default" : "secondary"}
                            className="text-xs flex-shrink-0"
                          >
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {template.imageUrl && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            Image attached
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTemplateSelect(template)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                        data-testid={`button-edit-template-${template.id}`}
                        title="Edit Template"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestTemplate(template)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                        data-testid={`button-test-template-${template.id}`}
                        title="Test Template"
                      >
                        <TestTube className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(template.id)}
                        disabled={deleteMutation.isPending}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                        data-testid={`button-archive-template-${template.id}`}
                        title="Archive Template"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Preview */}
                  <div className="mb-4">
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                      <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
                        {isExpanded ? previewText : truncatedPreview}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Full Preview */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleCard(template.id)}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 p-0 text-xs text-muted-foreground hover:text-foreground w-full justify-center"
                      >
                        {isExpanded ? (
                          <>Hide Details <ChevronUp className="ml-1 h-3 w-3" /></>
                        ) : (
                          <>Show Details <ChevronDown className="ml-1 h-3 w-3" /></>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-3">
                      {/* Image Preview in Details */}
                      {template.imageUrl && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Template Image</p>
                          <div className="max-w-xs">
                            <img
                              src={template.imageUrl}
                              alt={template.name}
                              className="w-full rounded-md border border-border shadow-sm"
                              data-testid={`img-template-full-${template.id}`}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Template Details */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-accent/30 rounded-md">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                          <p className="text-sm">{new Date(template.createdAt || Date.now()).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                          <Badge 
                            variant={template.isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>

                      {/* Variables Used */}
                      {(() => {
                        const variables = extractVariables(template.template);
                        return variables.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Variables Used</p>
                            <div className="flex flex-wrap gap-1">
                              {variables.map((variable) => (
                                <Badge key={variable} variant="outline" className="text-xs font-mono">
                                  {`{${variable}}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onTemplateSelect(template)}
                          className="flex items-center justify-center bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400"
                          data-testid={`button-quick-edit-template-${template.id}`}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestTemplate(template)}
                          className="flex items-center justify-center bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                          data-testid={`button-quick-test-template-${template.id}`}
                        >
                          <TestTube className="mr-2 h-4 w-4" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isPending}
                          className="flex items-center justify-center bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400"
                          data-testid={`button-quick-archive-template-${template.id}`}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Test Template Dialog */}
      <Dialog open={!!testDialogOpen} onOpenChange={(open) => !open && setTestDialogOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Select a channel to test this template:
              </p>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger data-testid="select-test-channel">
                  <SelectValue placeholder="Select a channel..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(channelsData) && channelsData.length > 0 ? (
                    channelsData.map((channel: any) => (
                      <SelectItem 
                        key={channel.id} 
                        value={channel.id}
                        data-testid={`channel-option-${channel.id}`}
                      >
                        {channel.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-channels" disabled>
                      No channels configured
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {testDialogOpen && (
              <div className="bg-muted/50 rounded-lg p-3 border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
                <div className="text-sm text-foreground whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                  {generatePreview(templates.find(t => t.id === testDialogOpen)?.template || "")}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setTestDialogOpen(null)}
                data-testid="button-cancel-test"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSendTest}
                disabled={!selectedChannel || testMutation.isPending}
                data-testid="button-send-test"
              >
                {testMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
