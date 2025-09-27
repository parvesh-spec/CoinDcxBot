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
import { Upload, X, FileText, Save, Loader2, Wand2, Languages, Zap, Sparkles } from "lucide-react";
import ObjectUploader from "@/components/ui/object-uploader";
import { ResearchReport } from "@shared/schema"; // Import correct type

// Form validation schema
const researchReportSchema = z.object({
  type: z.enum(['pattern-based', 'level-based'], {
    errorMap: () => ({ message: "Please select report type" })
  }),
  pair: z.string().min(1, "Trading pair is required"),
  supportLevel: z.string().optional(),
  resistance: z.string().optional(),
  summary: z.string().optional(),
  upsideTarget1: z.string().optional(),
  upsideTarget2: z.string().optional(),
  downsideTarget1: z.string().optional(),
  downsideTarget2: z.string().optional(),
  breakoutDirection: z.enum(['upside', 'downside'], {
    errorMap: () => ({ message: "Please select breakout direction" })
  }).optional(),
  imageUrl: z.string().min(1, "Chart image is required"),
});

type ResearchReportFormData = z.infer<typeof researchReportSchema>;

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
  const [selectedLanguage, setSelectedLanguage] = useState<'english' | 'hinglish'>('english');
  const [selectedLevel, setSelectedLevel] = useState<'low' | 'medium'>('low');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const isEditMode = !!editReport;
  const isViewMode = !!editReport; // For now, we only open modal for viewing existing reports

  // Form setup
  const form = useForm<ResearchReportFormData>({
    resolver: zodResolver(researchReportSchema),
    defaultValues: isEditMode && editReport ? {
      type: (editReport as any).type || "pattern-based",
      pair: editReport.pair || "",
      supportLevel: editReport.supportLevel || "",
      resistance: editReport.resistanceLevel || "", // Fix field name
      summary: editReport.summary || "",
      upsideTarget1: (editReport.scenarios as any)?.upside?.target1 || "", // Extract from scenarios
      upsideTarget2: (editReport.scenarios as any)?.upside?.target2 || "", // Extract from scenarios
      downsideTarget1: (editReport.scenarios as any)?.downside?.target1 || "", // Extract from scenarios
      downsideTarget2: (editReport.scenarios as any)?.downside?.target2 || "", // Extract from scenarios
      breakoutDirection: (editReport.breakoutDirection as any) || undefined,
      imageUrl: editReport.imageUrl || "",
    } : {
      type: "pattern-based",
      pair: "",
      supportLevel: "",
      resistance: "",
      summary: "",
      upsideTarget1: "",
      upsideTarget2: "",
      downsideTarget1: "",
      downsideTarget2: "",
      breakoutDirection: undefined,
      imageUrl: "",
    },
  });

  // Reset form when editReport changes
  useEffect(() => {
    if (isEditMode && editReport) {
      form.reset({
        pair: editReport.pair || "",
        supportLevel: editReport.supportLevel || "",
        resistance: editReport.resistanceLevel || "", // Fix field name
        summary: editReport.summary || "",
        upsideTarget1: (editReport.scenarios as any)?.upside?.target1 || "", // Extract from scenarios
        upsideTarget2: (editReport.scenarios as any)?.upside?.target2 || "", // Extract from scenarios
        downsideTarget1: (editReport.scenarios as any)?.downside?.target1 || "", // Extract from scenarios
        downsideTarget2: (editReport.scenarios as any)?.downside?.target2 || "", // Extract from scenarios
        breakoutDirection: (editReport.breakoutDirection as any) || "upside",
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
      // Transform frontend data to match backend schema
      const transformedData = {
        pair: data.pair,
        supportLevel: data.supportLevel,
        resistanceLevel: data.resistance, // Fix field name
        summary: data.summary,
        scenarios: { // Structure targets into scenarios object
          upside: {
            target1: data.upsideTarget1,
            target2: data.upsideTarget2
          },
          downside: {
            target1: data.downsideTarget1,
            target2: data.downsideTarget2
          }
        },
        breakoutDirection: data.breakoutDirection,
        imageUrl: data.imageUrl
      };
      
      const response = await fetch('/api/research-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformedData),
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
      // Transform frontend data to match backend schema
      const transformedData = {
        pair: data.pair,
        supportLevel: data.supportLevel,
        resistanceLevel: data.resistance, // Fix field name
        summary: data.summary,
        scenarios: { // Structure targets into scenarios object
          upside: {
            target1: data.upsideTarget1,
            target2: data.upsideTarget2
          },
          downside: {
            target1: data.downsideTarget1,
            target2: data.downsideTarget2
          }
        },
        breakoutDirection: data.breakoutDirection,
        imageUrl: data.imageUrl
      };
      
      const response = await fetch(`/api/research-reports/${editReport?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformedData),
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
  const handleEnhanceText = async () => {
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
      const response = await apiRequest('POST', '/api/enhance-text', {
        text: currentText,
        language: selectedLanguage,
        level: selectedLevel
      });

      const data = await response.json();
      
      if (data.enhancedText) {
        form.setValue('summary', data.enhancedText);
        const levelText = selectedLevel === 'low' ? 'Grammar Corrected' : 'Enhanced';
        const langText = selectedLanguage === 'hinglish' ? 'Hinglish' : 'English';
        toast({
          title: "✨ Text Enhanced!",
          description: `Analysis ${levelText} in ${langText} using AI`,
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

  // If viewing mode, show clean display
  if (isViewMode && editReport) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Research Report Details
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-300">
                    {editReport.pair}
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    editReport.breakoutDirection === 'upside' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  }`}>
                    {editReport.breakoutDirection === 'upside' ? '📈 Upside Breakout' : '📉 Downside Breakout'}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {editReport.createdAt ? new Date(editReport.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Unknown'}
                </div>
              </div>

              {/* Support & Resistance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                    🟢 Support Level
                  </h4>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {editReport.supportLevel}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2">
                    🔴 Resistance Level
                  </h4>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {editReport.resistanceLevel}
                  </p>
                </div>
              </div>

              {/* Price Targets */}
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3">
                    🎯 Upside Targets
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Target 1</p>
                      <p className="text-lg font-semibold text-green-600">
                        {(editReport.scenarios as any)?.upside?.target1 || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Target 2</p>
                      <p className="text-lg font-semibold text-green-600">
                        {(editReport.scenarios as any)?.upside?.target2 || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-700 dark:text-red-300 mb-3">
                    🛑 Downside Targets
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Target 1</p>
                      <p className="text-lg font-semibold text-red-600">
                        {(editReport.scenarios as any)?.downside?.target1 || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Target 2</p>
                      <p className="text-lg font-semibold text-red-600">
                        {(editReport.scenarios as any)?.downside?.target2 || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Summary */}
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3">
                  📋 Market Analysis
                </h4>
                <p className="text-foreground leading-relaxed">
                  {editReport.summary}
                </p>
              </div>

              {/* Chart Image */}
              {editReport.imageUrl && (
                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-700 dark:text-orange-300 mb-3">
                    📊 Analysis Chart
                  </h4>
                  <div className="text-center">
                    <img 
                      src={editReport.imageUrl} 
                      alt="Analysis Chart"
                      className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              data-testid="button-close-view"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
                  {/* Report Type */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Type *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-report-type">
                              <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pattern-based" data-testid="option-pattern-based">
                              🔍 Pattern-based
                            </SelectItem>
                            <SelectItem value="level-based" data-testid="option-level-based">
                              📊 Level-based
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                        <FormLabel>Breakout Possibility</FormLabel>
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
                        <FormLabel>Support Level</FormLabel>
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
                        <FormLabel>Resistance Level</FormLabel>
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
                        <FormLabel>Target 1</FormLabel>
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
                        <FormLabel>Target 2</FormLabel>
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
                        <FormLabel>Target 1</FormLabel>
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
                        <FormLabel>Target 2</FormLabel>
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
                        <FormLabel>Analysis Summary</FormLabel>
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
      
      {/* Enhancement Options Modal */}
      <Dialog open={showLanguageModal} onOpenChange={setShowLanguageModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Wand2 className="w-5 h-5 mr-2 text-purple-600" />
              AI Enhancement Options
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose language and enhancement level for AI processing
            </p>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Language Style</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setSelectedLanguage('english')}
                  variant={selectedLanguage === 'english' ? 'default' : 'outline'}
                  className="justify-start p-3 h-auto"
                  data-testid="button-select-english"
                >
                  <span className="text-lg mr-2">🇺🇸</span>
                  <div className="text-left">
                    <div className="text-sm font-medium">English</div>
                    <div className="text-xs opacity-70">Professional</div>
                  </div>
                </Button>
                
                <Button
                  onClick={() => setSelectedLanguage('hinglish')}
                  variant={selectedLanguage === 'hinglish' ? 'default' : 'outline'}
                  className="justify-start p-3 h-auto"
                  data-testid="button-select-hinglish"
                >
                  <span className="text-lg mr-2">🇮🇳</span>
                  <div className="text-left">
                    <div className="text-sm font-medium">Hinglish</div>
                    <div className="text-xs opacity-70">Mixed Style</div>
                  </div>
                </Button>
              </div>
            </div>
            
            {/* Enhancement Level */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Enhancement Level</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setSelectedLevel('low')}
                  variant={selectedLevel === 'low' ? 'default' : 'outline'}
                  className="justify-start p-3 h-auto"
                  data-testid="button-select-low"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Low</div>
                    <div className="text-xs opacity-70">Grammar Fix</div>
                  </div>
                </Button>
                
                <Button
                  onClick={() => setSelectedLevel('medium')}
                  variant={selectedLevel === 'medium' ? 'default' : 'outline'}
                  className="justify-start p-3 h-auto"
                  data-testid="button-select-medium"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Medium</div>
                    <div className="text-xs opacity-70">Enhance Text</div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={() => setShowLanguageModal(false)}
              className="flex-1"
              data-testid="button-cancel-enhance"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnhanceText}
              disabled={isEnhancing}
              className="flex-1"
              data-testid="button-apply-enhancement"
            >
              {isEnhancing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Enhance Text
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}