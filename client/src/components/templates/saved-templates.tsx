import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ChevronDown, ChevronUp, Edit2, Copy, Trash2, Eye, Image } from "lucide-react";

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

  const generatePreview = (template: string, includeFields: any) => {
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

    // Replace variables with sample data only if field is included
    Object.entries(sampleData).forEach(([key, value]) => {
      const fieldKey = key === "profit_loss" ? "profitLoss" : key;
      if (includeFields && includeFields[fieldKey]) {
        const regex = new RegExp(`{${key}}`, "g");
        preview = preview.replace(regex, value);
      }
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
        <div className="grid gap-4">
          {templates.map((template) => {
            const isExpanded = expandedCards.has(template.id);
            const previewText = generatePreview(template.template, template.includeFields);
            const truncatedPreview = previewText.length > 150 
              ? previewText.substring(0, 150) + "..." 
              : previewText;
            
            return (
              <Card key={template.id} className="group hover:shadow-md transition-all duration-200" data-testid={`template-item-${template.id}`}>
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
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary/60"></span>
                          {template.channel?.name || "Unknown Channel"}
                        </p>
                        {template.imageUrl && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            Image attached
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCard(template.id)}
                        className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                        data-testid={`button-preview-template-${template.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTemplateSelect(template)}
                        className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(template.template)}
                        className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                        data-testid={`button-copy-template-${template.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(template.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Preview */}
                  <div className="mb-3">
                    <div className="bg-muted/50 rounded-md p-3 border-l-4 border-primary/20">
                      <div className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
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

                      {/* Included Fields */}
                      {template.includeFields && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Included Fields</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(template.includeFields)
                              .filter(([_, included]) => included)
                              .map(([field, _]) => (
                                <Badge key={field} variant="outline" className="text-xs">
                                  {field}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onTemplateSelect(template)}
                          className="flex-1"
                          data-testid={`button-quick-edit-template-${template.id}`}
                        >
                          <Edit2 className="mr-1 h-3 w-3" />
                          Edit Template
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(template.template)}
                          className="flex-1"
                          data-testid={`button-quick-copy-template-${template.id}`}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Text
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
    </div>
  );
}
