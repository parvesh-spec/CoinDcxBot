import { useState, useEffect } from "react";
import { useLocation, useParams, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Upload, X, FileText, Save, Loader2 } from "lucide-react";
import { Link } from "wouter";

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
  breakoutPossibility: z.string().min(5, "Breakout possibility must be at least 5 characters"),
  upsidePercentage: z.number().min(0).max(1000),
  downsidePercentage: z.number().min(0).max(100),
  imageUrl: z.string().optional(),
});

type ResearchReportFormData = z.infer<typeof researchReportSchema>;

interface ResearchReport extends ResearchReportFormData {
  id: string;
  reportId: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function ResearchReportForm() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/research-reports/:id/edit");
  const [createMatch] = useRoute("/research-reports/create");
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const isEditMode = match && params?.id;
  const reportId = params?.id;

  // Fetch existing report for edit mode
  const { data: existingReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['/api/research-reports', reportId],
    enabled: !!isEditMode && !!reportId
  }) as { data: ResearchReport | undefined, isLoading: boolean };

  // Form setup
  const form = useForm<ResearchReportFormData>({
    resolver: zodResolver(researchReportSchema),
    defaultValues: {
      pair: "",
      supportLevel: "",
      resistance: "",
      summary: "",
      upsideTarget1: "",
      upsideTarget2: "",
      downsideTarget1: "",
      downsideTarget2: "",
      breakoutPossibility: "",
      upsidePercentage: 0,
      downsidePercentage: 0,
      imageUrl: "",
    }
  });

  // Load existing data for edit mode
  useEffect(() => {
    if (isEditMode && existingReport) {
      form.reset({
        pair: existingReport.pair,
        supportLevel: existingReport.supportLevel,
        resistance: existingReport.resistance,
        summary: existingReport.summary,
        upsideTarget1: existingReport.upsideTarget1,
        upsideTarget2: existingReport.upsideTarget2,
        downsideTarget1: existingReport.downsideTarget1,
        downsideTarget2: existingReport.downsideTarget2,
        breakoutPossibility: existingReport.breakoutPossibility,
        upsidePercentage: existingReport.upsidePercentage,
        downsidePercentage: existingReport.downsidePercentage,
        imageUrl: existingReport.imageUrl || "",
      });
      
      if (existingReport.imageUrl) {
        setImagePreview(existingReport.imageUrl);
      }
    }
  }, [existingReport, isEditMode, form]);

  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File): Promise<{ imageUrl: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'research-reports');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Image upload failed');
      }
      
      return response.json();
    }
  });

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
        description: "Research report created successfully",
      });
      navigate("/research-reports");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create research report",
        variant: "destructive",
      });
    }
  });

  // Update research report mutation
  const updateMutation = useMutation({
    mutationFn: async (data: ResearchReportFormData) => {
      const response = await fetch(`/api/research-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update research report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/research-reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/research-reports', reportId] });
      toast({
        title: "Success",
        description: "Research report updated successfully",
      });
      navigate("/research-reports");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update research report",
        variant: "destructive",
      });
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    form.setValue("imageUrl", "");
  };

  const onSubmit = async (data: ResearchReportFormData) => {
    try {
      // Upload image if selected
      if (imageFile) {
        setIsUploading(true);
        const uploadResult = await uploadImageMutation.mutateAsync(imageFile);
        data.imageUrl = uploadResult.imageUrl;
        setIsUploading(false);
      }

      // Submit form
      if (isEditMode) {
        updateMutation.mutate(data);
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || isUploading;

  // Show loading for edit mode
  if (isEditMode && isLoadingReport) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading research report...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/research-reports">
          <Button variant="outline" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? "Edit Research Report" : "Create Research Report"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode 
              ? "Update your market analysis and price targets"
              : "Analyze market trends and set price targets for trading pairs"
            }
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Research Report Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="upsidePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upside %</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.1"
                            placeholder="15.5"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-upside-percentage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="downsidePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Downside %</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.1"
                            placeholder="8.2"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-downside-percentage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Price Levels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          data-testid="input-resistance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Targets */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Price Targets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-green-600 dark:text-green-400">Upside Targets</h4>
                    <div className="grid grid-cols-2 gap-3">
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
                                data-testid="input-upside-target-1"
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
                                data-testid="input-upside-target-2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-red-600 dark:text-red-400">Downside Targets</h4>
                    <div className="grid grid-cols-2 gap-3">
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
                                data-testid="input-downside-target-1"
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
                                data-testid="input-downside-target-2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Market Analysis</h3>
                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Analysis Summary *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide detailed market analysis, key factors, and reasoning behind the price targets..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="textarea-summary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="breakoutPossibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breakout Possibility *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Assess the likelihood and conditions for breakout scenarios..."
                            className="min-h-[80px]"
                            {...field}
                            data-testid="textarea-breakout-possibility"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Chart Analysis (Optional)</h3>
                <div className="space-y-4">
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <div className="space-y-2">
                        <h4 className="font-medium">Upload Chart Image</h4>
                        <p className="text-sm text-muted-foreground">
                          Support technical analysis with chart screenshots (PNG, JPG, max 10MB)
                        </p>
                        <Label htmlFor="image-upload">
                          <Button type="button" variant="outline" data-testid="button-upload-image">
                            <Upload className="w-4 h-4 mr-2" />
                            Choose Image
                          </Button>
                        </Label>
                        <Input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Chart preview"
                        className="w-full max-w-md mx-auto rounded-lg border"
                        data-testid="image-preview"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                        data-testid="button-remove-image"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Link href="/research-reports">
                  <Button type="button" variant="outline" data-testid="button-cancel">
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isUploading ? "Uploading..." : isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {isEditMode ? "Update Report" : "Create Report"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}