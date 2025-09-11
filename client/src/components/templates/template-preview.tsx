import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TemplatePreviewProps {
  template: string;
  buttons?: any[][];
  parseMode?: string;
  imageUrl?: string;
}

export default function TemplatePreview({ template, buttons = [], parseMode = "HTML", imageUrl }: TemplatePreviewProps) {
  const generatePreview = () => {
    let preview = template;

    // Sample data for preview
    const sampleData = {
      pair: "B-ETH_USDT",
      price: "$4,285.67",
      type: "BUY",
      leverage: "50x",
      stopLoss: "$4,200.00",
      takeProfit1: "$4,350.00",
      takeProfit2: "$4,415.00",
      takeProfit3: "$4,480.00",
      safebookPrice: "$4,325.00",
      timestamp: "Dec 15, 2024 14:32",
      profitLoss: "+$5,234",
    };

    // Replace all variables with sample data
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, "g");
      preview = preview.replace(regex, value);
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
    let formattedText = text;
    
    if (parseMode === "HTML") {
      // Convert HTML tags to proper HTML for rendering
      formattedText = formattedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;b&gt;/g, '<strong>')
        .replace(/&lt;\/b&gt;/g, '</strong>')
        .replace(/&lt;i&gt;/g, '<em>')
        .replace(/&lt;\/i&gt;/g, '</em>')
        .replace(/&lt;code&gt;/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">')
        .replace(/&lt;\/code&gt;/g, '</code>');
    } else if (parseMode === "Markdown") {
      // Convert Markdown to HTML
      formattedText = formattedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    }
    
    return formattedText;
  };

  const createMarkup = (text: string) => {
    return { __html: renderFormattedText(text) };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-background border rounded-lg p-4 shadow-sm space-y-3" style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0'
        }}>
          {/* Image Preview */}
          {imageUrl && (
            <div className="mb-3" data-testid="image-preview">
              <img
                src={imageUrl}
                alt="Template image"
                className="w-full max-w-md mx-auto h-auto rounded-lg border border-gray-200 shadow-sm"
                style={{ maxHeight: '300px', objectFit: 'contain' }}
                data-testid="img-template-preview"
              />
            </div>
          )}
          
          {/* Text Preview */}
          <div
            className="text-sm text-foreground whitespace-pre-wrap leading-relaxed"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              lineHeight: '1.5'
            }}
            data-testid="text-template-preview"
            dangerouslySetInnerHTML={createMarkup(generatePreview())}
          />
          
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
          <p>Format: {parseMode} • Buttons: {buttons?.length || 0} rows{imageUrl ? ' • Image: Yes' : ''}</p>
        </div>
      </CardContent>
    </Card>
  );
}
