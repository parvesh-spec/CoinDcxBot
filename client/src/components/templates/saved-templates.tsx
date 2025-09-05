import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Templates</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {templates.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <i className="fas fa-edit text-2xl mb-2" />
            <p>No templates found</p>
            <p className="text-sm">Create your first message template above</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 hover:bg-accent transition-colors"
                data-testid={`template-item-${template.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">
                      {template.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {template.channel?.name || "Unknown Channel"}
                    </p>
                    {!template.isActive && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 mt-1">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTemplateSelect(template)}
                      className="text-primary hover:text-primary/80"
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <i className="fas fa-edit h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(template.template)}
                      className="text-muted-foreground hover:text-foreground"
                      data-testid={`button-copy-template-${template.id}`}
                    >
                      <i className="fas fa-copy h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(template.id)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive hover:text-destructive/80"
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <i className="fas fa-trash h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
