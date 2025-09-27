import { useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { insertAutomationSchema, type TelegramChannel, type MessageTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface AddAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editAutomation?: any; // Will be typed properly when passed from parent
}

// Form schema with validation - create our own since insertAutomationSchema uses .refine()
const formSchema = z.object({
  name: z.string().min(1, "Automation name is required").max(100, "Name too long"),
  channelId: z.string().min(1, "Please select a channel"),
  templateId: z.string().min(1, "Please select a template"),
  automationType: z.enum(['trade', 'simple', 'research_report'], {
    required_error: "Please select automation type",
  }),
  triggerType: z.string().min(1, "Please select trigger type"),
  sourceFilter: z.string().optional(),
  signalTypeFilter: z.string().optional(),
  researchReportTypeFilter: z.string().optional(),
  scheduledTime: z.string().optional(),
  scheduledDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
  delayMinutes: z.number().min(0).max(1440).optional(),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function AddAutomationModal({ isOpen, onClose, editAutomation }: AddAutomationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch channels and templates for dropdowns
  const { data: channels = [], isLoading: channelsLoading } = useQuery<TelegramChannel[]>({
    queryKey: ["/api/channels"],
    enabled: isOpen,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/templates"],
    enabled: isOpen,
  });

  // Determine if this is edit mode
  const isEditMode = !!editAutomation;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: isEditMode ? {
      name: editAutomation.name || "",
      channelId: editAutomation.channelId || "",
      templateId: editAutomation.templateId || "",
      automationType: editAutomation.automationType || "trade",
      triggerType: editAutomation.triggerType || "trade_registered",
      sourceFilter: editAutomation.sourceFilter || "all",
      signalTypeFilter: editAutomation.signalTypeFilter || "all",
      researchReportTypeFilter: editAutomation.researchReportTypeFilter || "all",
      scheduledTime: editAutomation.scheduledTime || "",
      scheduledDays: editAutomation.scheduledDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      delayMinutes: editAutomation.delayMinutes || 0,
      isActive: editAutomation.isActive ?? true,
    } : {
      name: "",
      channelId: "",
      templateId: "",
      automationType: "trade",
      triggerType: "trade_registered",
      sourceFilter: "all",
      signalTypeFilter: "all",
      researchReportTypeFilter: "all",
      scheduledTime: "",
      scheduledDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      delayMinutes: 0,
      isActive: true,
    },
  });

  // Reset form when editAutomation changes
  useEffect(() => {
    if (isEditMode && editAutomation) {
      form.reset({
        name: editAutomation.name || "",
        channelId: editAutomation.channelId || "",
        templateId: editAutomation.templateId || "",
        automationType: editAutomation.automationType || "trade",
        triggerType: editAutomation.triggerType || "trade_registered",
        sourceFilter: editAutomation.sourceFilter || "all",
        signalTypeFilter: editAutomation.signalTypeFilter || "all",
        researchReportTypeFilter: editAutomation.researchReportTypeFilter || "all",
        scheduledTime: editAutomation.scheduledTime || "",
        scheduledDays: editAutomation.scheduledDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        delayMinutes: editAutomation.delayMinutes || 0,
        isActive: editAutomation.isActive ?? true,
      });
    } else if (!isEditMode) {
      form.reset({
        name: "",
        channelId: "",
        templateId: "",
        automationType: "trade",
        triggerType: "trade_registered",
        sourceFilter: "all",
        signalTypeFilter: "all",
        researchReportTypeFilter: "all",
        scheduledTime: "",
        scheduledDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        delayMinutes: 0,
        isActive: true,
      });
    }
  }, [editAutomation, isEditMode, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditMode && editAutomation) {
        return await apiRequest("PATCH", `/api/automations/${editAutomation.id}`, data);
      } else {
        return await apiRequest("POST", "/api/automations", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Success",
        description: isEditMode ? "Automation updated successfully" : "Automation created successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} automation:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} automation`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Convert IST time to UTC for database storage
    const processedData = { ...data };
    
    if (data.automationType === 'simple' && data.scheduledTime) {
      // Convert IST (UTC+5:30) to UTC
      // User enters 9:00 AM IST, we store 3:30 AM UTC
      const [hours, minutes] = data.scheduledTime.split(':').map(Number);
      const istDate = new Date();
      istDate.setHours(hours, minutes, 0, 0);
      
      // Subtract 5.5 hours to convert IST to UTC
      const utcDate = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000));
      
      // Format back to HH:MM
      const utcHours = utcDate.getHours().toString().padStart(2, '0');
      const utcMinutes = utcDate.getMinutes().toString().padStart(2, '0');
      processedData.scheduledTime = `${utcHours}:${utcMinutes}`;
      
      console.log(`Time conversion: ${data.scheduledTime} IST → ${processedData.scheduledTime} UTC`);
    }
    
    saveMutation.mutate(processedData);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const getTriggerLabel = (value: string) => {
    switch (value) {
      case "trade_registered":
        return "When Trade is Registered (Active Status)";
      case "stop_loss_hit":
        return "When Stop Loss is Triggered";
      case "safe_book_hit":
        return "When Safe Book is Triggered";
      case "target_1_hit":
        return "When Target 1 is Hit";
      case "target_2_hit":
        return "When Target 2 is Hit";
      case "target_3_hit":
        return "When Target 3 is Hit";
      default:
        return value;
    }
  };

  // Filter active channels and templates (memoized)
  const activeChannels = useMemo(() => channels.filter(channel => channel.isActive), [channels]);
  const activeTemplates = useMemo(() => templates.filter(template => template.isActive), [templates]);
  
  const isSubmitDisabled = channelsLoading || templatesLoading || activeChannels.length === 0 || activeTemplates.length === 0 || saveMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-automation">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Automation" : "Add New Automation"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update your automation rule for sending Telegram messages automatically."
              : "Create a new automation rule to send Telegram messages automatically based on trade events."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Automation Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Automation Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Notify on Trade Complete"
                      {...field} 
                      data-testid="input-automation-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Automation Type Selection */}
            <FormField
              control={form.control}
              name="automationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Automation Type</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    // Reset trigger type when automation type changes
                    if (value === 'trade') {
                      form.setValue('triggerType', 'trade_registered');
                    } else if (value === 'research_report') {
                      form.setValue('triggerType', 'research_report_submit');
                    } else {
                      form.setValue('triggerType', 'scheduled');
                    }
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-automation-type">
                        <SelectValue placeholder="Select automation type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trade">Trade-Based (Triggered by trade events)</SelectItem>
                      <SelectItem value="research_report">Research Report-Based (Triggered by report creation)</SelectItem>
                      <SelectItem value="simple">Time-Based (Scheduled messages)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Channel Selection */}
            <FormField
              control={form.control}
              name="channelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram Channel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-channel">
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {channelsLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading channels...
                          </div>
                        </SelectItem>
                      ) : activeChannels.length === 0 ? (
                        <SelectItem value="no-channels" disabled>
                          No active channels available
                        </SelectItem>
                      ) : (
                        activeChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Message Template with filtering based on automation type */}
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => {
                const automationType = form.watch('automationType');
                const filteredTemplates = activeTemplates.filter(template => {
                  if (automationType === 'trade') {
                    return template.templateType === 'trade' || !template.templateType; // Default to trade for existing templates
                  } else if (automationType === 'research_report') {
                    return template.templateType === 'research_report';
                  } else {
                    return template.templateType === 'simple';
                  }
                });

                return (
                  <FormItem>
                    <FormLabel>Message Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                      {templatesLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading templates...
                          </div>
                        </SelectItem>
                      ) : activeTemplates.length === 0 ? (
                        <SelectItem value="no-templates" disabled>
                          No active templates available
                        </SelectItem>
                      ) : filteredTemplates.length === 0 ? (
                        <SelectItem value="no-filtered-templates" disabled>
                          No {automationType} templates available
                        </SelectItem>
                      ) : (
                        filteredTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.templateType || 'trade'})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
                );
              }}
            />

            {/* Conditional Trigger Type Selection based on automation type */}
            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => {
                const automationType = form.watch('automationType');
                return (
                  <FormItem>
                    <FormLabel>Trigger Event</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trigger-type">
                          <SelectValue placeholder="Select when to trigger" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {automationType === 'trade' ? (
                          <>
                            <SelectItem value="trade_registered">
                              {getTriggerLabel("trade_registered")}
                            </SelectItem>
                            <SelectItem value="stop_loss_hit">
                              {getTriggerLabel("stop_loss_hit")}
                            </SelectItem>
                            <SelectItem value="safe_book_hit">
                              {getTriggerLabel("safe_book_hit")}
                            </SelectItem>
                            <SelectItem value="target_1_hit">
                              {getTriggerLabel("target_1_hit")}
                            </SelectItem>
                            <SelectItem value="target_2_hit">
                              {getTriggerLabel("target_2_hit")}
                            </SelectItem>
                            <SelectItem value="target_3_hit">
                              {getTriggerLabel("target_3_hit")}
                            </SelectItem>
                          </>
                        ) : automationType === 'research_report' ? (
                          <SelectItem value="research_report_submit">
                            Research Report Created (Triggered when report is submitted)
                          </SelectItem>
                        ) : (
                          <SelectItem value="scheduled">
                            Scheduled Time (Time-based automation)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Trade Filters for Trade-Based Automations */}
            {form.watch('automationType') === 'trade' && (
              <>
                {/* Source Filter */}
                <FormField
                  control={form.control}
                  name="sourceFilter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Filter (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source-filter">
                            <SelectValue placeholder="Select source filter" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          <SelectItem value="coindcx">CoinDCX Exchange</SelectItem>
                          <SelectItem value="api">API Registered</SelectItem>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Only trigger automation for trades from selected source. Leave empty to include all sources.
                      </p>
                    </FormItem>
                  )}
                />

                {/* Signal Type Filter */}
                <FormField
                  control={form.control}
                  name="signalTypeFilter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signal Type Filter (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-signal-type-filter">
                            <SelectValue placeholder="Select signal type filter" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Signal Types</SelectItem>
                          <SelectItem value="intraday">Intraday</SelectItem>
                          <SelectItem value="swing">Swing</SelectItem>
                          <SelectItem value="scalp">Scalp</SelectItem>
                          <SelectItem value="positional">Positional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Only trigger automation for trades with selected signal type. Leave empty to include all types.
                      </p>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Research Report Filters for Research Report Automations */}
            {form.watch('automationType') === 'research_report' && (
              <>
                {/* Research Report Type Filter */}
                <FormField
                  control={form.control}
                  name="researchReportTypeFilter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Research Report Type Filter (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-research-report-type-filter">
                            <SelectValue placeholder="Select report type filter" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Report Types</SelectItem>
                          <SelectItem value="pattern-based">🔍 Pattern-based</SelectItem>
                          <SelectItem value="level-based">📊 Level-based</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Only trigger automation for selected research report type. Leave empty to include all types.
                      </p>
                    </FormItem>
                  )}
                />

                {/* Delay Minutes */}
                <FormField
                  control={form.control}
                  name="delayMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delay Minutes (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="1440"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : 0)}
                          data-testid="input-delay-minutes"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Delay message sending after report creation (0-1440 minutes). Leave empty for immediate sending.
                      </p>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Time Scheduling Fields for Simple Automations */}
            {form.watch('automationType') === 'simple' && (
              <FormField
                control={form.control}
                name="scheduledTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Time (Kolkata Timezone)</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        placeholder="09:00"
                        data-testid="input-scheduled-time"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Messages will be sent daily at this time in Kolkata timezone (UTC+5:30)
                    </p>
                  </FormItem>
                )}
              />
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saveMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                data-testid="button-create-automation"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  isEditMode ? "Update Automation" : "Create Automation"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}