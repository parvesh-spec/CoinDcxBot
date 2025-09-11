import { useMemo } from "react";
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
}

// Form schema with validation
const formSchema = insertAutomationSchema.extend({
  name: z.string().min(1, "Automation name is required").max(100, "Name too long"),
});

type FormData = z.infer<typeof formSchema>;

export default function AddAutomationModal({ isOpen, onClose }: AddAutomationModalProps) {
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      channelId: "",
      templateId: "",
      triggerType: "trade_registered",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/automations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Success",
        description: "Automation created successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      console.error("Error creating automation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create automation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const getTriggerLabel = (value: string) => {
    switch (value) {
      case "trade_registered":
        return "When Trade is Registered (Active Status)";
      case "trade_completed":
        return "When Trade is Completed";
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
  
  const isSubmitDisabled = channelsLoading || templatesLoading || activeChannels.length === 0 || activeTemplates.length === 0 || createMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-automation">
        <DialogHeader>
          <DialogTitle>Add New Automation</DialogTitle>
          <DialogDescription>
            Create a new automation rule to send Telegram messages automatically based on trade events.
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

            {/* Template Selection */}
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
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
                      ) : (
                        activeTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trigger Type Selection */}
            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-trigger-type">
                        <SelectValue placeholder="Select when to trigger" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trade_registered">
                        {getTriggerLabel("trade_registered")}
                      </SelectItem>
                      <SelectItem value="trade_completed">
                        {getTriggerLabel("trade_completed")}
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                data-testid="button-create-automation"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Automation"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}