import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TemplateEditor from "@/components/templates/template-editor";
import TemplatePreview from "@/components/templates/template-preview";
import SavedTemplates from "@/components/templates/saved-templates";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function TemplatesPage() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewData, setPreviewData] = useState({
    template: `🚨 TRADE ALERT 🚨

📊 Pair: {pair}
💰 Price: {price}
📈 Type: {type}
📦 Quantity: {quantity}
⏰ Time: {timestamp}

#CoinDCX #Trading`,
    includeFields: {
      pair: true,
      price: true,
      type: true,
      quantity: true,
      timestamp: true,
      profitLoss: false,
    },
    buttons: [] as any[][],
    parseMode: "HTML",
  });

  const { data: templatesData, refetch: refetchTemplates, error: templatesError } = useQuery({
    queryKey: ["/api/templates"],
    retry: false,
  });

  const { data: channelsData } = useQuery({
    queryKey: ["/api/channels"],
    retry: false,
  });

  // Handle unauthorized errors
  if (templatesError && isUnauthorizedError(templatesError)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  const handleTemplateChange = (template: string, includeFields: any, buttons?: any[][], parseMode?: string) => {
    setPreviewData({ 
      template, 
      includeFields, 
      buttons: buttons || [],
      parseMode: parseMode || "HTML"
    });
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setPreviewData({
      template: template.template,
      includeFields: template.includeFields,
      buttons: template.buttons || [],
      parseMode: template.parseMode || "HTML",
    });
  };

  const handleTemplateSaved = () => {
    refetchTemplates();
    setSelectedTemplate(null);
    toast({
      title: "Success",
      description: "Template saved successfully",
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Template Editor */}
          <TemplateEditor
            channels={Array.isArray(channelsData) ? channelsData : []}
            selectedTemplate={selectedTemplate}
            onTemplateChange={handleTemplateChange}
            onTemplateSaved={handleTemplateSaved}
            onClearSelection={() => setSelectedTemplate(null)}
          />

          {/* Preview and Saved Templates */}
          <div className="space-y-6">
            <TemplatePreview
              template={previewData.template}
              includeFields={previewData.includeFields}
              buttons={previewData.buttons}
              parseMode={previewData.parseMode}
            />
            
            <SavedTemplates
              templates={Array.isArray(templatesData) ? templatesData : []}
              onTemplateSelect={handleTemplateSelect}
              onTemplateDeleted={refetchTemplates}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
