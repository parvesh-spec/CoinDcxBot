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
import ObjectUploader from "@/components/ui/object-uploader";
import RichTextEditor from "@/components/ui/rich-text-editor";

interface TemplateEditorProps {
  channels: any[];
  selectedTemplate: any;
  onTemplateChange: (template: string, buttons?: any[][], parseMode?: string, imageUrl?: string) => void;
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
    templateType: "trade",
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
    buttons: [] as any[][],
    parseMode: "HTML",
    imageUrl: "",
  });

  useEffect(() => {
    if (selectedTemplate) {
      setFormData({
        name: selectedTemplate.name,
        channelId: selectedTemplate.channelId,
        templateType: selectedTemplate.templateType || "trade",
        template: selectedTemplate.template,
        buttons: selectedTemplate.buttons || [],
        parseMode: selectedTemplate.parseMode || "HTML",
        imageUrl: selectedTemplate.imageUrl || "",
      });
    }
  }, [selectedTemplate]);

  useEffect(() => {
    onTemplateChange(formData.template, formData.buttons, formData.parseMode, formData.imageUrl);
  }, [formData.template, formData.buttons, formData.parseMode, formData.imageUrl, onTemplateChange]);

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
          templateType: "trade",
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
          buttons: [],
          parseMode: "HTML",
          imageUrl: "",
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

  const handleSave = () => {
    if (!formData.name || !formData.template) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check for variables in simple message templates
    if (formData.templateType === 'simple') {
      const variablePattern = /{[a-zA-Z_][a-zA-Z0-9_]*}/g;
      const variables = formData.template.match(variablePattern);
      if (variables && variables.length > 0) {
        toast({
          title: "Validation Error",
          description: `Simple message templates cannot contain variables. Found: ${variables.join(', ')}`,
          variant: "destructive",
        });
        return;
      }
    }

    saveMutation.mutate({
      name: formData.name,
      channelId: null, // No channel selection needed
      templateType: formData.templateType,
      template: formData.template,
      buttons: formData.buttons,
      parseMode: formData.parseMode,
      imageUrl: formData.imageUrl,
      isActive: true,
    });
  };

  // Button management functions
  const addButtonRow = () => {
    setFormData(prev => ({
      ...prev,
      buttons: [...prev.buttons, [{ text: '', url: '' }]]
    }));
  };

  const removeButtonRow = (rowIndex: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, index) => index !== rowIndex)
    }));
  };

  const addButtonToRow = (rowIndex: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((row, index) => 
        index === rowIndex ? [...row, { text: '', url: '' }] : row
      )
    }));
  };

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((row, index) => 
        index === rowIndex 
          ? row.filter((_, bIndex) => bIndex !== buttonIndex)
          : row
      ).filter(row => row.length > 0) // Remove empty rows
    }));
  };

  const updateButton = (rowIndex: number, buttonIndex: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((row, rIndex) => 
        rIndex === rowIndex 
          ? row.map((button, bIndex) => 
              bIndex === buttonIndex 
                ? { ...button, [field]: value }
                : button
            )
          : row
      )
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

        {/* Template Type Selection */}
        <div>
          <Label htmlFor="templateType">Template Type *</Label>
          <Select
            value={formData.templateType}
            onValueChange={(value) => {
              setFormData(prev => ({ 
                ...prev, 
                templateType: value,
                // Reset template content when switching types
                template: value === 'simple' 
                  ? `📢 Daily Update

Good morning! Hope you're having a great day.

Stay tuned for more updates.

#CoinDCX` 
                  : `🚨 TRADE ALERT 🚨

📊 Pair: {pair}
💰 Price: {price}
📈 Type: {type}
⚡ Leverage: {leverage}x
🛑 Stop Loss: {stopLoss}
🎯 Take Profit 1: {takeProfit1}
🎯 Take Profit 2: {takeProfit2}
🎯 Take Profit 3: {takeProfit3}
⏰ Time: {timestamp}

#CoinDCX #Trading`
              }));
            }}
          >
            <SelectTrigger data-testid="select-template-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trade">Trade Message (with variables)</SelectItem>
              <SelectItem value="simple">Simple Message (no variables)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Trade messages can use variables like {"{pair}"}, {"{price}"}. Simple messages cannot use variables.
          </p>
        </div>

        {/* Message Template */}
        <div>
          <Label htmlFor="template">Message Template *</Label>
          <RichTextEditor
            value={formData.template}
            onChange={(value) => setFormData(prev => ({ ...prev, template: value }))}
            placeholder="Enter your message template here..."
            className="mt-2"
            minHeight={250}
          />
          {formData.templateType === 'trade' && (
            <div className="mt-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-2">
              <div className="text-xs font-medium text-blue-900 dark:text-blue-100">🔧 Available Variables for Trade Messages:</div>
              <div className="flex flex-wrap gap-1">
                {[
                  "{pair}", "{price}", "{type}", "{leverage}", "{stopLoss}", 
                  "{takeProfit1}", "{takeProfit2}", "{takeProfit3}", 
                  "{safebookPrice}", "{timestamp}", "{profitLoss}"
                ].map(variable => (
                  <span 
                    key={variable}
                    className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded text-xs font-mono cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                    onClick={() => {
                      const newTemplate = formData.template + variable;
                      setFormData(prev => ({ ...prev, template: newTemplate }));
                    }}
                  >
                    {variable}
                  </span>
                ))}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                💡 Click on any variable above to add it to your template
              </div>
            </div>
          )}
          
          {formData.templateType === 'simple' && (
            <div className="mt-3 p-3 border rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <div className="text-xs font-medium text-orange-900 dark:text-orange-100">⚠️ Variable Restriction:</div>
              <div className="text-xs text-orange-700 dark:text-orange-300">
                Simple message templates cannot use variables like {"{pair}"}, {"{price}"}, etc. Use static text only.
              </div>
            </div>
          )}
        </div>

        {/* Parse Mode Selection */}
        <div>
          <Label htmlFor="parseMode">Message Format</Label>
          <Select
            value={formData.parseMode}
            onValueChange={(value) => setFormData(prev => ({ ...prev, parseMode: value }))}
          >
            <SelectTrigger data-testid="select-parse-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HTML">HTML</SelectItem>
              <SelectItem value="Markdown">Markdown</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            HTML supports <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;code&gt;</code> tags. Markdown supports **bold**, *italic*, `code`.
          </p>
        </div>

        {/* Image Upload Section */}
        <div>
          <ObjectUploader
            onImageUploaded={(imageUrl) => setFormData(prev => ({ ...prev, imageUrl }))}
            onImageRemoved={() => setFormData(prev => ({ ...prev, imageUrl: "" }))}
            currentImageUrl={formData.imageUrl}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Upload an optional image to include with your message template. Supports PNG, JPG, GIF up to 5MB.
          </p>
        </div>

        {/* Inline Buttons Configuration */}
        <div>
          <div className="flex items-center justify-between">
            <Label>Inline Buttons</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addButtonRow}
              data-testid="button-add-row"
            >
              <i className="fas fa-plus mr-1" />
              Add Row
            </Button>
          </div>
          
          {formData.buttons.length > 0 && (
            <div className="space-y-3 mt-3">
              {formData.buttons.map((row, rowIndex) => (
                <div key={rowIndex} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Row {rowIndex + 1}</Label>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addButtonToRow(rowIndex)}
                        data-testid={`button-add-to-row-${rowIndex}`}
                      >
                        <i className="fas fa-plus mr-1" />
                        Add Button
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeButtonRow(rowIndex)}
                        data-testid={`button-remove-row-${rowIndex}`}
                      >
                        <i className="fas fa-trash mr-1" />
                        Remove Row
                      </Button>
                    </div>
                  </div>
                  
                  {row.map((button, buttonIndex) => (
                    <div key={buttonIndex} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/50 rounded">
                      <div>
                        <Label htmlFor={`button-text-${rowIndex}-${buttonIndex}`} className="text-xs">
                          Button Text *
                        </Label>
                        <Input
                          id={`button-text-${rowIndex}-${buttonIndex}`}
                          placeholder="e.g., View Trade"
                          value={button.text || ''}
                          onChange={(e) => updateButton(rowIndex, buttonIndex, 'text', e.target.value)}
                          data-testid={`input-button-text-${rowIndex}-${buttonIndex}`}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor={`button-url-${rowIndex}-${buttonIndex}`} className="text-xs">
                          URL (optional)
                        </Label>
                        <Input
                          id={`button-url-${rowIndex}-${buttonIndex}`}
                          placeholder="https://example.com/{tradeId}"
                          value={button.url || ''}
                          onChange={(e) => updateButton(rowIndex, buttonIndex, 'url', e.target.value)}
                          data-testid={`input-button-url-${rowIndex}-${buttonIndex}`}
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeButton(rowIndex, buttonIndex)}
                          className="w-full"
                          data-testid={`button-remove-${rowIndex}-${buttonIndex}`}
                        >
                          <i className="fas fa-trash mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-2 p-2 border rounded bg-muted/20">
            <div className="text-xs font-medium text-muted-foreground mb-1">🔘 Button Variables:</div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Use any template variable in button text: <code>{"{pair}"}</code>, <code>{"{price}"}</code>, etc.</div>
              <div>• Use variables in URLs: <code>https://example.com/trade/{"{pair}"}</code></div>
              <div>• Example: Text: "View {"{pair}"}" • URL: "https://site.com/{"{pair}"}"</div>
            </div>
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
        </div>
      </CardContent>
    </Card>
  );
}
