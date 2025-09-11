import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TemplatePreviewProps {
  template: string;
  includeFields: any;
  buttons?: any[][];
  parseMode?: string;
}

export default function TemplatePreview({ template, includeFields, buttons = [], parseMode = "HTML" }: TemplatePreviewProps) {
  const generatePreview = () => {
    let preview = template;

    // Sample data for preview
    const sampleData = {
      pair: "B-ETH_USDT",
      price: "₹4,285.67",
      type: "BUY",
      leverage: "50x",
      stopLoss: "₹4,200.00",
      takeProfit1: "₹4,350.00",
      takeProfit2: "₹4,415.00",
      takeProfit3: "₹4,480.00",
      safebookPrice: "₹4,325.00",
      timestamp: "Dec 15, 2024 14:32",
      profitLoss: "+₹5,234",
    };

    // Replace variables with sample data only if field is included
    Object.entries(sampleData).forEach(([key, value]) => {
      const fieldKey = key;
      if (includeFields[fieldKey]) {
        const regex = new RegExp(`{${key}}`, "g");
        preview = preview.replace(regex, value);
      } else {
        // Remove variables that are not included
        const regex = new RegExp(`{${key}}`, "g");
        preview = preview.replace(regex, `{${key}}`);
      }
    });

    return preview;
  };

  const generateButtonPreview = () => {
    if (!buttons || buttons.length === 0) return null;

    // Sample data for button variable replacement
    const sampleData = {
      pair: "B-ETH_USDT",
      price: "4285.67",
      type: "BUY",
      leverage: "50",
      stopLoss: "4200.00",
      takeProfit1: "4350.00", 
      takeProfit2: "4415.00",
      takeProfit3: "4480.00",
      safebookPrice: "4325.00",
      timestamp: "Dec15-2024",
      tradeId: "TXN-12345",
      profitLoss: "5234"
    };

    return buttons.map((row, rowIndex) => (
      <div key={rowIndex} className="flex gap-2 flex-wrap">
        {row.map((button, buttonIndex) => {
          let buttonText = button.text || '';
          let buttonUrl = button.url || '';
          
          // Replace variables in button text and URL
          Object.entries(sampleData).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            buttonText = buttonText.replace(regex, value);
            buttonUrl = buttonUrl.replace(regex, value);
          });

          return (
            <Button
              key={buttonIndex}
              variant="outline"
              size="sm"
              className="text-xs"
              disabled
              data-testid={`preview-button-${rowIndex}-${buttonIndex}`}
            >
              {buttonText || 'Button Text'}
              {buttonUrl && <i className="fas fa-external-link-alt ml-1" />}
            </Button>
          );
        })}
      </div>
    ));
  };

  const renderFormattedText = (text: string) => {
    if (parseMode === "HTML") {
      // Simple HTML preview - just show tags visually
      return text
        .replace(/<b>/g, '𝗕')
        .replace(/<\/b>/g, '𝗕')
        .replace(/<i>/g, '𝘐')
        .replace(/<\/i>/g, '𝘐')
        .replace(/<code>/g, '`')
        .replace(/<\/code>/g, '`');
    } else if (parseMode === "Markdown") {
      // Simple Markdown preview
      return text
        .replace(/\*\*(.*?)\*\*/g, '𝗕$1𝗕')
        .replace(/\*(.*?)\*/g, '𝘐$1𝘐')
        .replace(/`(.*?)`/g, '`$1`');
    }
    return text;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded-lg p-4 border-l-4 border-primary space-y-3">
          {/* Text Preview */}
          <div
            className="text-sm font-mono text-foreground whitespace-pre-wrap"
            data-testid="text-template-preview"
          >
            {renderFormattedText(generatePreview())}
          </div>
          
          {/* Buttons Preview */}
          {buttons && buttons.length > 0 && (
            <div className="space-y-2" data-testid="buttons-preview">
              <div className="text-xs text-muted-foreground border-t pt-2">
                Inline Buttons:
              </div>
              <div className="space-y-2">
                {generateButtonPreview()}
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          <p>This preview updates in real-time as you edit the template</p>
          <p>Format: {parseMode} • Buttons: {buttons?.length || 0} rows</p>
        </div>
      </CardContent>
    </Card>
  );
}
