import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TemplateEditor from "@/components/templates/template-editor";
import TemplatePreview from "@/components/templates/template-preview";
import SavedTemplates from "@/components/templates/saved-templates";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TemplatesPage() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [previewData, setPreviewData] = useState({
    template: `🚨 TRADE ALERT 🚨

📊 Pair: {pair}
💰 Price: {price}
📈 Type: {type}
📦 Quantity: {quantity}
⏰ Time: {timestamp}

#CoinDCX #Trading`,
    buttons: [] as any[][],
    parseMode: "HTML",
    imageUrl: "",
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

  const handleTemplateChange = (template: string, buttons?: any[][], parseMode?: string, imageUrl?: string) => {
    setPreviewData({ 
      template, 
      buttons: buttons || [],
      parseMode: parseMode || "HTML",
      imageUrl: imageUrl || "",
    });
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setPreviewData({
      template: template.template,
      buttons: template.buttons || [],
      parseMode: template.parseMode || "HTML",
      imageUrl: template.imageUrl || "",
    });
  };

  const handleTemplateSaved = () => {
    refetchTemplates();
    setSelectedTemplate(null);
    setIsDesignerOpen(false);
    toast({
      title: "Success",
      description: "Template saved successfully",
    });
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setIsDesignerOpen(true);
  };

  const handleTemplateEdit = (template: any) => {
    setSelectedTemplate(template);
    setIsDesignerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
                <p className="text-sm text-muted-foreground">Design and manage your trading alerts</p>
              </div>
            </div>
            <Dialog open={isDesignerOpen} onOpenChange={setIsDesignerOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={handleNewTemplate}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid="button-add-new-template"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTemplate ? 'Edit Template' : 'Create New Template'}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  <TemplateEditor
                    channels={Array.isArray(channelsData) ? channelsData : []}
                    selectedTemplate={selectedTemplate}
                    onTemplateChange={handleTemplateChange}
                    onTemplateSaved={handleTemplateSaved}
                    onClearSelection={() => {
                      setSelectedTemplate(null);
                      setIsDesignerOpen(false);
                    }}
                  />
                  <TemplatePreview
                    template={previewData.template}
                    buttons={previewData.buttons}
                    parseMode={previewData.parseMode}
                    imageUrl={previewData.imageUrl}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <SavedTemplates
          templates={Array.isArray(templatesData) ? templatesData : []}
          onTemplateSelect={handleTemplateEdit}
          onTemplateDeleted={refetchTemplates}
        />
      </div>
    </div>
  );
}
