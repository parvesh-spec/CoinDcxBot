import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

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
      // Trade variables
      pair: "BTC-USDT",
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
      signalType: "Intraday",
      
      // Research report variables
      supportLevel: "42,500 to 42,800",
      resistanceLevel: "45,200 to 45,500", 
      summary: "yha se support lagha hai jalse hi ye support break hoga to sell positional me or nhi hoga to buy swing me",
      upsideTarget1: "46,000.00",
      upsideTarget2: "47,500.00",
      downsideTarget1: "41,200.00", 
      downsideTarget2: "39,800.00",
      breakoutDirection: "upside",
      reportId: "RP-2024-001",
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
      // Trade variables
      pair: "BTC-USDT",
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
      profitLoss: "5234",
      signalType: "Intraday",
      
      // Research report variables
      supportLevel: "42500-42800",
      resistanceLevel: "45200-45500",
      summary: "support-analysis",
      upsideTarget1: "46000",
      upsideTarget2: "47500",
      downsideTarget1: "41200",
      downsideTarget2: "39800",
      breakoutDirection: "upside",
      reportId: "RP-2024-001",
    };

    return buttons.map((row, rowIndex) => (
      <div key={rowIndex} className="flex gap-1">
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
            <button
              key={buttonIndex}
              type="button"
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 text-xs px-3 py-2 rounded-md font-medium opacity-75 cursor-not-allowed"
              disabled
              data-testid={`preview-button-${rowIndex}-${buttonIndex}`}
            >
              <span className="truncate">
                {buttonText || 'Button Text'}
              </span>
              {buttonUrl && (
                <span className="ml-1 text-slate-400">🔗</span>
              )}
            </button>
          );
        })}
      </div>
    ));
  };

  const renderFormattedText = (text: string) => {
    let formattedText = text;
    
    // Convert HTML tags to proper HTML for rendering
    formattedText = formattedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;/g, '<strong>')
      .replace(/&lt;\/b&gt;/g, '</strong>')
      .replace(/&lt;strong&gt;/g, '<strong>')
      .replace(/&lt;\/strong&gt;/g, '</strong>')
      .replace(/&lt;i&gt;/g, '<em>')
      .replace(/&lt;\/i&gt;/g, '</em>')
      .replace(/&lt;em&gt;/g, '<em>')
      .replace(/&lt;\/em&gt;/g, '</em>')
      .replace(/&lt;u&gt;/g, '<u>')
      .replace(/&lt;\/u&gt;/g, '</u>')
      .replace(/&lt;s&gt;/g, '<s>')
      .replace(/&lt;\/s&gt;/g, '</s>')
      .replace(/&lt;code&gt;/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">')
      .replace(/&lt;\/code&gt;/g, '</code>')
      .replace(/&lt;pre&gt;/g, '<pre class="bg-muted px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap">')
      .replace(/&lt;\/pre&gt;/g, '</pre>');
    
    return formattedText;
  };

  const createMarkup = (text: string) => {
    return { __html: renderFormattedText(text) };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            TB
          </span>
          Telegram Message Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Telegram Chat Interface */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 max-w-lg mx-auto">
          {/* Chat Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              TB
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">Trading Bot</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">online</div>
            </div>
          </div>
          
          {/* Message Bubble */}
          <div className="flex justify-end mb-2">
            <div className="max-w-[85%]">
              <div className="bg-white text-black rounded-2xl rounded-br-md px-4 py-3 shadow-sm border">
                {/* Image Preview */}
                {imageUrl && (
                  <div className="mb-3" data-testid="image-preview">
                    <img
                      src={imageUrl}
                      alt="Template image"
                      className="w-full h-auto rounded-lg"
                      style={{ maxHeight: '200px', objectFit: 'cover' }}
                      data-testid="img-template-preview"
                    />
                  </div>
                )}
                
                {/* Text Content */}
                <div
                  className="text-sm whitespace-pre-wrap leading-relaxed"
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    lineHeight: '1.4'
                  }}
                  data-testid="text-template-preview"
                  dangerouslySetInnerHTML={createMarkup(generatePreview())}
                />
                
                {/* Time Stamp */}
                <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>14:32</span>
                  <span className="text-gray-400">✓✓</span>
                </div>
              </div>
              
              {/* Inline Buttons */}
              {buttons && buttons.length > 0 && (
                <div className="mt-2 space-y-1" data-testid="buttons-preview">
                  {generateButtonPreview()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground mt-4 text-center space-y-1">
          <p>✨ Live Telegram-style preview • Updates as you type</p>
          <p>Format: HTML • Buttons: {buttons?.length || 0} rows{imageUrl ? ' • Image: Yes' : ''}</p>
        </div>
      </CardContent>
    </Card>
  );
}
