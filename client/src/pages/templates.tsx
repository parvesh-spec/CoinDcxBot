import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { MessageTemplate, insertMessageTemplateSchema } from "@shared/schema";
import { z } from "zod";

const templateFormSchema = insertMessageTemplateSchema.extend({
  name: z.string().min(1, "Template name is required"),
  template: z.string().min(1, "Template message is required"),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function TemplatesPage() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  
  const defaultFormValues: TemplateFormData = {
    name: "",
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
    channelId: null,
    isActive: true,
  };
  
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: defaultFormValues,
  });

  // Fetch templates
  const { data: templates = [], isLoading, error, refetch } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/templates"],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: TemplateFormData) => {
      return await apiRequest("POST", "/api/templates", templateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setIsCreateModalOpen(false);
      form.reset(defaultFormValues);
      toast({
        title: "Success",
        description: "Template created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("DELETE", `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
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

  // Generate preview with sample data
  const generatePreview = (template: string, includeFields: Record<string, boolean>) => {
    const sampleData = {
      pair: "B-ETH_USDT",
      price: "₹4,205.67",
      type: "BUY",
      quantity: "0.5",
      timestamp: "Dec 15, 2024 14:32",
      profitLoss: "₹2,300.00",
    };

    let preview = template;
    Object.entries(sampleData).forEach(([key, value]) => {
      if (includeFields[key]) {
        preview = preview.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    });

    return preview;
  };

  const onSubmit = (data: TemplateFormData) => {
    createTemplateMutation.mutate(data);
  };
  
  const handleDeleteTemplate = (templateId: string) => {
    deleteTemplateMutation.mutate(templateId);
    setDeleteTemplateId(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Message Templates</h1>
            <p className="text-muted-foreground">
              Create and manage custom message templates for trade notifications
            </p>
          </div>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" data-testid="button-add-template">
                <Plus className="mr-2 h-4 w-4" />
                Add New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Template Editor */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., BTC Buy Signal"
                              data-testid="input-template-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="template"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message Template *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter your template message..."
                              className="font-mono"
                              rows={8}
                              data-testid="textarea-template-message"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-sm text-muted-foreground">
                            Use variables: {"{pair}"}, {"{price}"}, {"{type}"}, {"{quantity}"}, {"{timestamp}"}, {"{profitLoss}"}
                          </p>
                        </FormItem>
                      )}
                    />
                    
                    {/* Include Fields Configuration */}
                    <div className="space-y-3">
                      <FormLabel>Include Fields</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'pair', label: 'Trading Pair' },
                          { key: 'price', label: 'Price' },
                          { key: 'type', label: 'Trade Type' },
                          { key: 'quantity', label: 'Quantity' },
                          { key: 'timestamp', label: 'Timestamp' },
                          { key: 'profitLoss', label: 'Profit/Loss' },
                        ].map(({ key, label }) => (
                          <FormField
                            key={key}
                            control={form.control}
                            name={`includeFields.${key}` as keyof TemplateFormData}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value as boolean}
                                    onCheckedChange={field.onChange}
                                    data-testid={`checkbox-${key}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex space-x-4">
                      <Button
                        type="submit"
                        disabled={createTemplateMutation.isPending}
                        data-testid="button-save-template"
                      >
                        {createTemplateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Template"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateModalOpen(false);
                          form.reset(defaultFormValues);
                        }}
                        data-testid="button-cancel-template"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                
                  {/* Live Preview */}
                  <div>
                    <FormLabel>Live Preview</FormLabel>
                    <Card className="mt-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-muted-foreground">Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                          {generatePreview(form.watch('template'), form.watch('includeFields'))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          This preview updates in real-time as you edit the template
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-2 text-muted-foreground">Loading templates...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              Failed to load templates
            </h3>
            <p className="text-muted-foreground mb-6">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              No templates created yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Create your first message template to get started with automated notifications
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <AlertDialog open={deleteTemplateId === template.id} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTemplateId(template.id)}
                          disabled={deleteTemplateMutation.isPending}
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{template.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`confirm-delete-${template.id}`}
                          >
                            {deleteTemplateMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(template.includeFields).map(([field, included]) => 
                      included && (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      )
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                    <div className="font-mono text-sm whitespace-pre-wrap text-foreground/80 max-h-32 overflow-y-auto">
                      {generatePreview(template.template, template.includeFields)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}