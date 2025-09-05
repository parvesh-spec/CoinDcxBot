import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TemplatePreviewProps {
  template: string;
  includeFields: any;
}

export default function TemplatePreview({ template, includeFields }: TemplatePreviewProps) {
  const generatePreview = () => {
    let preview = template;

    // Sample data for preview
    const sampleData = {
      pair: "BTC/INR",
      price: "₹28,45,672",
      type: "BUY",
      quantity: "0.0125",
      timestamp: "Dec 15, 2024 14:32",
      profit_loss: "+₹5,234",
    };

    // Replace variables with sample data only if field is included
    Object.entries(sampleData).forEach(([key, value]) => {
      const fieldKey = key === "profit_loss" ? "profitLoss" : key;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
          <div
            className="text-sm font-mono text-foreground whitespace-pre-wrap"
            data-testid="text-template-preview"
          >
            {generatePreview()}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This preview updates in real-time as you edit the template
        </p>
      </CardContent>
    </Card>
  );
}
