import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCopyTradingUserSchema, type CopyTradingUser, type InsertCopyTradingUser } from "@shared/schema";
import { z } from "zod";

export default function CopyTradingUsersPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CopyTradingUser | null>(null);

  // Form schema with validation
  const formSchema = insertCopyTradingUserSchema.extend({
    apiKey: z.string().min(1, "API Key is required"),
    apiSecret: z.string().min(1, "API Secret is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      telegramId: "",
      telegramUsername: "",
      exchange: "coindcx",
      apiKey: "",
      apiSecret: "",
      riskPerTrade: 2.0,
      maxDailyLoss: undefined,
      isActive: true,
      notes: "",
    },
  });

  // Fetch copy trading users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/copy-trading/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/copy-trading/users");
      return response.json() as Promise<CopyTradingUser[]>;
    },
  });

  // Add/Update user mutation
  const saveUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof formSchema>) => {
      if (editingUser) {
        return apiRequest("PUT", `/api/copy-trading/users/${editingUser.id}`, userData);
      } else {
        return apiRequest("POST", "/api/copy-trading/users", userData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/users"] });
      setIsAddDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({
        title: editingUser ? "User updated successfully!" : "User added successfully!",
        description: "Copy trading user has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save user",
        description: error.message || "An error occurred while saving the user.",
        variant: "destructive",
      });
    },
  });

  // Toggle user active status
  const toggleUserMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/copy-trading/users/${userId}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/users"] });
      toast({
        title: "User status updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/copy-trading/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/users"] });
      toast({
        title: "User deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveUserMutation.mutate(values);
  };

  const handleEditUser = (user: CopyTradingUser) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername || "",
      exchange: user.exchange,
      apiKey: "", // Don't populate for security
      apiSecret: "", // Don't populate for security
      riskPerTrade: parseFloat(user.riskPerTrade),
      maxDailyLoss: user.maxDailyLoss ? parseFloat(user.maxDailyLoss) : undefined,
      isActive: !!user.isActive,
      notes: user.notes || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    form.reset();
    setIsAddDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading copy trading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Copy Trading Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts for copy trading. When enabled, trades will be automatically copied to their accounts.
          </p>
        </div>
        <Button onClick={handleAddUser} data-testid="button-add-user">
          <i className="fas fa-plus mr-2" />
          Add User
        </Button>
      </div>

      {/* Users Grid */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <i className="fas fa-users text-4xl text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No copy trading users yet</h3>
                <p className="text-muted-foreground">
                  Add your first copy trading user to start copying trades automatically.
                </p>
              </div>
              <Button onClick={handleAddUser}>
                <i className="fas fa-plus mr-2" />
                Add First User
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user: CopyTradingUser) => (
            <Card key={user.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{user.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={!!user.isActive}
                      onCheckedChange={(checked) =>
                        toggleUserMutation.mutate({ userId: user.id, isActive: checked })
                      }
                      disabled={toggleUserMutation.isPending}
                      data-testid={`switch-user-${user.id}`}
                    />
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {user.telegramUsername ? `@${user.telegramUsername}` : `ID: ${user.telegramId}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Exchange:</span>
                    <Badge variant="outline">{user.exchange.toUpperCase()}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk per Trade:</span>
                    <span className="font-medium">{user.riskPerTrade}%</span>
                  </div>
                  {user.maxDailyLoss && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Max Daily Loss:</span>
                      <span className="font-medium">{user.maxDailyLoss}%</span>
                    </div>
                  )}
                  {user.notes && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Notes:</strong> {user.notes}
                    </div>
                  )}
                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                      data-testid={`button-edit-${user.id}`}
                    >
                      <i className="fas fa-edit mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteUserMutation.mutate(user.id)}
                      disabled={deleteUserMutation.isPending}
                      data-testid={`button-delete-${user.id}`}
                    >
                      <i className="fas fa-trash mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit Copy Trading User" : "Add Copy Trading User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details and trading settings."
                : "Add a new user for copy trading. Their API credentials will be securely stored."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telegramId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram ID</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789" {...field} data-testid="input-telegram-id" />
                    </FormControl>
                    <FormDescription>Numeric Telegram user ID</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telegramUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telegram Username (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} value={field.value || ""} data-testid="input-telegram-username" />
                    </FormControl>
                    <FormDescription>Without @ symbol</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exchange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exchange</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exchange">
                          <SelectValue placeholder="Select exchange" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="coindcx">CoinDCX</SelectItem>
                        <SelectItem value="binance" disabled>Binance (Coming Soon)</SelectItem>
                        <SelectItem value="delta" disabled>Delta Exchange (Coming Soon)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={editingUser ? "Enter new API key to update" : "API Key"}
                        {...field}
                        data-testid="input-api-key"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={editingUser ? "Enter new API secret to update" : "API Secret"}
                        {...field}
                        data-testid="input-api-secret"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="riskPerTrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk per Trade (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          data-testid="input-risk-per-trade"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxDailyLoss"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Daily Loss (%) - Optional</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="50"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid="input-max-daily-loss"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this user..."
                        {...field}
                        value={field.value || ""}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable Copy Trading</FormLabel>
                      <FormDescription>
                        When enabled, trades will be automatically copied to this user's account.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  data-testid="button-save"
                >
                  {saveUserMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      Saving...
                    </>
                  ) : editingUser ? (
                    "Update User"
                  ) : (
                    "Add User"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}