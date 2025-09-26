import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, X, FileText, Save, Loader2, Wand2, Languages } from "lucide-react";
import ObjectUploader from "@/components/ui/object-uploader";

// Form validation schema
const researchReportSchema = z.object({
  pair: z.string().min(1, "Trading pair is required"),
  supportLevel: z.string().min(1, "Support level is required"),
  resistance: z.string().min(1, "Resistance level is required"),
  summary: z.string().min(10, "Summary must be at least 10 characters"),
  upsideTarget1: z.string().min(1, "First upside target is required"),
  upsideTarget2: z.string().min(1, "Second upside target is required"),
  downsideTarget1: z.string().min(1, "First downside target is required"),
  downsideTarget2: z.string().min(1, "Second downside target is required"),
  breakoutDirection: z.enum(['upside', 'downside'], {
    errorMap: () => ({ message: "Please select breakout direction" })
  }),
  imageUrl: z.string().optional(),
});

type ResearchReportFormData = z.infer<typeof researchReportSchema>;

interface ResearchReport extends ResearchReportFormData {
  id: string;
  reportId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ResearchReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  editReport?: ResearchReport | null;
  onSuccess?: () => void;
}

export default function ResearchReportModal({ isOpen, onClose, editReport, onSuccess }: ResearchReportModalProps) {
  const { toast } = useToast();
  
  // Enhancement state
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const isEditMode = !!editReport;

  // Form setup
  const form = useForm<ResearchReportFormData>({
    resolver: zodResolver(researchReportSchema),
    defaultValues: isEditMode && editReport ? {
      pair: editReport.pair || "",
      supportLevel: editReport.supportLevel || "",
      resistance: editReport.resistance || "",
      summary: editReport.summary || "",
      upsideTarget1: editReport.upsideTarget1 || "",
      upsideTarget2: editReport.upsideTarget2 || "",
      downsideTarget1: editReport.downsideTarget1 || "",
      downsideTarget2: editReport.downsideTarget2 || "",
      breakoutDirection: editReport.breakoutDirection || "upside",
      imageUrl: editReport.imageUrl || "",
    } : {
      pair: "",
      supportLevel: "",
      resistance: "",
      summary: "",
      upsideTarget1: "",
      upsideTarget2: "",
      downsideTarget1: "",
      downsideTarget2: "",
      breakoutDirection: "upside",
      imageUrl: "",
    },
  });

  // Reset form when editReport changes
  useEffect(() => {
    if (isEditMode && editReport) {
      form.reset({
        pair: editReport.pair || "",
        supportLevel: editReport.supportLevel || "",
        resistance: editReport.resistance || "",
        summary: editReport.summary || "",
        upsideTarget1: editReport.upsideTarget1 || "",
        upsideTarget2: editReport.upsideTarget2 || "",
        downsideTarget1: editReport.downsideTarget1 || "",
        downsideTarget2: editReport.downsideTarget2 || "",
        breakoutDirection: editReport.breakoutDirection || "upside",
        imageUrl: editReport.imageUrl || "",
      });
    } else if (!isEditMode) {
      form.reset({
        pair: "",
        supportLevel: "",
        resistance: "",
        summary: "",
        upsideTarget1: "",
        upsideTarget2: "",
        downsideTarget1: "",
        downsideTarget2: "",
        breakoutDirection: "upside",
        imageUrl: "",
      });
    }
  }, [editReport, isEditMode, form]);

  // Create research report mutation
  const createMutation = useMutation({
    mutationFn: async (data: ResearchReportFormData) => {
      const response = await fetch('/api/research-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create research report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research-reports'] });
      toast({
        title: "Success",
        description: "Research report created successfully!",
      });
      onSuccess?.();
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      console.error('Create error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create research report. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update research report mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ResearchReportFormData) => {
      const response = await fetch(`/api/research-reports/${editReport?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update research report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/research-reports', editReport?.id] });
      toast({
        title: "Success",
        description: "Research report updated successfully!",
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update research report. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Enhancement functions
  const handleEnhanceText = async (language: 'english' | 'hinglish') => {
    const currentText = form.getValues('summary');
    
    if (!currentText?.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter some analysis text before enhancing",
        variant: "destructive"
      });
      return;
    }

    setIsEnhancing(true);
    setShowLanguageModal(false);

    try {
      const response = await apiRequest({
        url: '/api/enhance-text',
        method: 'POST',
        body: {
          text: currentText,
          language: language
        }
      });

      if (response.enhancedText) {
        form.setValue('summary', response.enhancedText);
        toast({
          title: "✨ Text Enhanced!",
          description: `Analysis enhanced in ${language === 'hinglish' ? 'Hinglish' : 'English'} using AI`,
        });
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      toast({
        title: "Enhancement Failed",
        description: "Failed to enhance text. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const onSubmit = (data: ResearchReportFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-600" />
            {isEditMode ? "Edit Research Report" : "Create Research Report"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEditMode ? "Update your market analysis and price targets" : "Analyze market trends and set price targets for trading pairs"}
          </p>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Research Report Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center text-blue-600">
                  📊 Research Report Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Trading Pair */}
                  <FormField
                    control={form.control}
                    name="pair"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trading Pair *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., BTC-USDT" 
                            {...field}
                            data-testid="input-pair"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Breakout Direction */}
                  <FormField
                    control={form.control}
                    name="breakoutDirection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breakout Possibility *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-breakout-direction">
                              <SelectValue placeholder="Select direction..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="upside" data-testid="option-upside">
                              📈 Upside
                            </SelectItem>
                            <SelectItem value="downside" data-testid="option-downside">
                              📉 Downside
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Support Level */}
                  <FormField
                    control={form.control}
                    name="supportLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Support Level *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 42500.00" 
                            {...field}
                            data-testid="input-support-level"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Resistance Level */}
                  <FormField
                    control={form.control}
                    name="resistance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resistance Level *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 48000.00" 
                            {...field}
                            data-testid="input-resistance-level"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Price Targets */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-green-600">🎯 Upside Targets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="upsideTarget1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target 1 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="50000.00" 
                            {...field}
                            data-testid="input-upside-target1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="upsideTarget2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target 2 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="52500.00" 
                            {...field}
                            data-testid="input-upside-target2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <h3 className="text-lg font-semibold text-red-600">🛑 Downside Targets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="downsideTarget1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target 1 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="40000.00" 
                            {...field}
                            data-testid="input-downside-target1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="downsideTarget2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target 2 *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="38500.00" 
                            {...field}
                            data-testid="input-downside-target2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Market Analysis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-600">📋 Market Analysis</h3>
                
                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Analysis Summary *</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowLanguageModal(true)}
                          disabled={isEnhancing}
                          className="flex items-center gap-2 text-xs"
                          data-testid="button-enhance"
                        >
                          {isEnhancing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wand2 className="w-3 h-3" />
                          )}
                          {isEnhancing ? "Enhancing..." : "✨ AI Enhance"}
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide detailed market analysis, key factors, and reasoning behind the price targets..."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="textarea-summary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              {/* Image Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-600">📊 Chart Upload</h3>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Analysis Chart (Optional)</FormLabel>
                      <FormControl>
                        <ObjectUploader
                          onImageUploaded={(imageUrl) => field.onChange(imageUrl)}
                          onImageRemoved={() => field.onChange("")}
                          currentImageUrl={field.value}
                          className="w-full"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Upload a chart image to support your analysis. Supports PNG, JPG, GIF up to 5MB.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-2 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isEditMode ? "Update Report" : "Create Report"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
      
      {/* Language Selection Modal */}
      <Dialog open={showLanguageModal} onOpenChange={setShowLanguageModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Languages className="w-5 h-5 mr-2 text-purple-600" />
              Choose Enhancement Language
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select the language style for AI enhancement
            </p>
          </DialogHeader>
          
          <div className="space-y-3 pt-4">
            <Button
              onClick={() => handleEnhanceText('english')}
              disabled={isEnhancing}
              className="w-full justify-start"
              variant="outline"
              data-testid="button-enhance-english"
            >
              <span className="text-lg mr-3">🇺🇸</span>
              <div className="text-left">
                <div className="font-medium">Professional English</div>
                <div className="text-xs text-muted-foreground">Formal business English with technical terms</div>
              </div>
            </Button>
            
            <Button
              onClick={() => handleEnhanceText('hinglish')}
              disabled={isEnhancing}
              className="w-full justify-start"
              variant="outline"
              data-testid="button-enhance-hinglish"
            >
              <span className="text-lg mr-3">🇮🇳</span>
              <div className="text-left">
                <div className="font-medium">Hinglish Style</div>
                <div className="text-xs text-muted-foreground">Hindi + English mix, conversational tone</div>
              </div>
            </Button>
          </div>
          
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => setShowLanguageModal(false)}
              className="w-full"
              data-testid="button-cancel-enhance"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}