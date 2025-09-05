import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TemplateEditorProps {
  channels: any[];
  selectedTemplate: any;
  onTemplateChange: (template: string, includeFields: any) => void;
  onTemplateSaved: () => void;
  onClearSelection: () => void;
}

export default function TemplateEditor({
  channels,
  selectedTemplate,
  onTemplateChange,
  onTemplateSaved,
  onClearSelection,
}: TemplateEditorProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    channelId: "",
    template: `🚨 TRADE ALERT 🚨

📊 Pair: {pair}
💰 Price: {price}
📈 Type: {type}
⚡ Leverage: {leverage}x
🛑 Stop Loss: {stopLoss}
🎯 Take Profit 1: {takeProfit1}
🎯 Take Profit 2: {takeProfit2}
🎯 Take Profit 3: {takeProfit3}
⏰ Time: {timestamp}

#CoinDCX #Trading`,
    includeFields: {
      pair: true,
      price: true,
      type: true,
      leverage: true,
      stopLoss: true,
      takeProfit1: true,
      takeProfit2: true,
      takeProfit3: true,
      timestamp: true,
      profitLoss: false,
    },
  });

  useEffect(() => {
    if (selectedTemplate) {
      setFormData({
        name: selectedTemplate.name,
        channelId: selectedTemplate.channelId,
        template: selectedTemplate.template,
        includeFields: selectedTemplate.includeFields,
      });
    }
  }, [selectedTemplate]);

  useEffect(() => {
    onTemplateChange(formData.template, formData.includeFields);
  }, [formData.template, formData.includeFields, onTemplateChange]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedTemplate) {
        await apiRequest("PUT", `/api/templates/${selectedTemplate.id}`, data);
      } else {
        await apiRequest("POST", "/api/templates", data);
      }
    },
    onSuccess: () => {
      onTemplateSaved();
      if (!selectedTemplate) {
        setFormData({
          name: "",
          channelId: "",
          template: `🚨 TRADE ALERT 🚨

📊 Pair: {pair}
💰 Price: {price}
📈 Type: {type}
⚡ Leverage: {leverage}x
🛑 Stop Loss: {stopLoss}
🎯 Take Profit 1: {takeProfit1}
🎯 Take Profit 2: {takeProfit2}
🎯 Take Profit 3: {takeProfit3}
⏰ Time: {timestamp}

#CoinDCX #Trading`,
          includeFields: {
            pair: true,
            price: true,
            type: true,
            leverage: true,
            stopLoss: true,
            takeProfit1: true,
            takeProfit2: true,
            takeProfit3: true,
            timestamp: true,
            profitLoss: false,
          },
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/templates/test", {
        template: formData.template,
        channelId: "default", // Default channel for testing
        includeFields: formData.includeFields,
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

  const handleSave = () => {
    if (!formData.name || !formData.template) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      name: formData.name,
      channelId: "default", // Default channel ID since we don't need selection
      template: formData.template,
      includeFields: formData.includeFields,
      isActive: true,
    });
  };

  const handleTest = () => {
    if (!formData.template) {
      toast({
        title: "Validation Error", 
        description: "Please enter a template",
        variant: "destructive",
      });
      return;
    }

    testMutation.mutate();
  };

  const handleFieldChange = (field: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      includeFields: {
        ...prev.includeFields,
        [field]: checked,
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Message Template Designer
          {selectedTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              data-testid="button-clear-selection"
            >
              <i className="fas fa-times mr-2" />
              Clear
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Design custom message templates for your trading alerts
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Template Name */}
        <div>
          <Label htmlFor="templateName">Template Name *</Label>
          <Input
            id="templateName"
            placeholder="e.g., BTC Buy Signal"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            data-testid="input-template-name"
          />
        </div>

        {/* Message Template */}
        <div>
          <Label htmlFor="template">Message Template *</Label>
          <Textarea
            id="template"
            rows={8}
            placeholder="Enter your message template here..."
            value={formData.template}
            onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
            data-testid="textarea-template"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Use variables: {"{pair}"}, {"{price}"}, {"{type}"}, {"{leverage}"}, {"{stopLoss}"}, {"{takeProfit1}"}, {"{takeProfit2}"}, {"{takeProfit3}"}, {"{timestamp}"}
          </p>
        </div>

        {/* Data Selection */}
        <div>
          <Label>Include Data Fields</Label>
          <div className="space-y-2 mt-2">
            {Object.entries(formData.includeFields).map(([field, checked]) => (
              <div key={field} className="flex items-center space-x-2">
                <Checkbox
                  id={field}
                  checked={checked}
                  onCheckedChange={(checked) => handleFieldChange(field, !!checked)}
                  data-testid={`checkbox-${field}`}
                />
                <Label htmlFor={field} className="text-sm capitalize">
                  {field === "profitLoss" ? "Profit/Loss" : 
                   field === "takeProfit1" ? "Take Profit 1" :
                   field === "takeProfit2" ? "Take Profit 2" :
                   field === "takeProfit3" ? "Take Profit 3" :
                   field === "stopLoss" ? "Stop Loss" :
                   field.replace(/([A-Z])/g, ' $1')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex-1"
            data-testid="button-save-template"
          >
            {saveMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2" />
                {selectedTemplate ? "Update Template" : "Save Template"}
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending || !formData.channelId}
            data-testid="button-test-template"
          >
            {testMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2" />
                Testing...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane mr-2" />
                Test
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
