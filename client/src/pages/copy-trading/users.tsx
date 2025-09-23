import React, { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCopyTradingUserSchema, type CopyTradingUser, type InsertCopyTradingUser } from "@shared/schema";
import { z } from "zod";

// Extended type for user with wallet balance information
interface CopyTradingUserWithWallet extends CopyTradingUser {
  walletBalance?: any[] | null;
  walletError?: string | null;
}

export default function CopyTradingUsersPage() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CopyTradingUser | null>(null);
  const [activeTab, setActiveTab] = useState("users");
  const [approvingApplication, setApprovingApplication] = useState<any | null>(null);
  const [rejectingApplication, setRejectingApplication] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Form schema with validation
  const formSchema = insertCopyTradingUserSchema.extend({
    apiKey: z.string().min(1, "API Key is required"),
    apiSecret: z.string().min(1, "API Secret is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      telegramId: "",
      telegramUsername: "",
      exchange: "coindcx",
      apiKey: "",
      apiSecret: "",
      riskPerTrade: 2.0,
      tradeFund: 100.0,
      maxTradesPerDay: undefined,
      isActive: true,
      notes: "",
    },
  });

  // Fetch copy trading users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/copy-trading/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/copy-trading/users");
      return response.json() as Promise<CopyTradingUserWithWallet[]>;
    },
  });

  // Fetch copy trading applications
  const { data: applicationsData, isLoading: isLoadingApplications } = useQuery({
    queryKey: ["/api/copy-trading/applications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/copy-trading/applications");
      return response.json() as Promise<{ applications: any[]; total: number }>;
    },
  });

  const applications = applicationsData?.applications || [];

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

  // Approve application mutation
  const approveApplicationMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/copy-trading/applications/${id}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/users"] });
      setApprovingApplication(null);
      setAdminNotes("");
      toast({
        title: "Application approved!",
        description: "User has been created and application approved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject application mutation
  const rejectApplicationMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/copy-trading/applications/${id}/reject`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/applications"] });
      setRejectingApplication(null);
      setAdminNotes("");
      toast({
        title: "Application rejected",
        description: "Application has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveUserMutation.mutate(values);
  };

  const handleEditUser = (user: CopyTradingUserWithWallet) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      telegramId: user.telegramId || "",
      telegramUsername: user.telegramUsername || "",
      exchange: user.exchange,
      apiKey: "", // Don't populate for security
      apiSecret: "", // Don't populate for security
      riskPerTrade: parseFloat(user.riskPerTrade),
      tradeFund: parseFloat(user.tradeFund),
      maxTradesPerDay: user.maxTradesPerDay ? parseFloat(user.maxTradesPerDay.toString()) : undefined,
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
          <h1 className="text-3xl font-bold">Copy Trading Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and review applications for copy trading.
          </p>
        </div>
        <Button onClick={handleAddUser} data-testid="button-add-user">
          <i className="fas fa-plus mr-2" />
          Add User
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" data-testid="tab-users">
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="applications" data-testid="tab-applications">
            Applications ({applications.filter(app => app.status === 'pending').length} pending)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">

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
          {users.map((user: CopyTradingUserWithWallet) => (
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trade Fund:</span>
                    <span className="font-medium text-blue-600">{user.tradeFund} USDT</span>
                  </div>
                  
                  {/* Futures Wallet Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Futures Wallet:</span>
                    <div className="text-right">
                      {user.walletBalance ? (
                        <div className="space-y-1">
                          {/* Show USDT balance prominently */}
                          {user.walletBalance.find((wallet: any) => wallet.short_name === 'USDT') ? (
                            <div className="font-medium text-green-600">
                              {parseFloat(user.walletBalance.find((wallet: any) => wallet.short_name === 'USDT').balance || '0').toFixed(2)} USDT
                            </div>
                          ) : (
                            <div className="font-medium text-muted-foreground">No USDT</div>
                          )}
                          {/* Show total wallets count */}
                          <div className="text-xs text-muted-foreground">
                            {user.walletBalance.length} currencies
                          </div>
                        </div>
                      ) : user.walletError ? (
                        <div className="text-xs text-red-500/70" title={user.walletError}>
                          {user.walletError === 'Invalid API credentials' ? (
                            <>
                              <i className="fas fa-key mr-1" />
                              Invalid API key
                            </>
                          ) : user.walletError === 'API access forbidden' ? (
                            <>
                              <i className="fas fa-ban mr-1" />
                              Futures not enabled
                            </>
                          ) : (
                            <>
                              <i className="fas fa-exclamation-triangle mr-1" />
                              Balance unavailable
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          <i className="fas fa-spinner fa-spin mr-1" />
                          Loading...
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {user.maxTradesPerDay && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Max Trades/Day:</span>
                      <span className="font-medium">{user.maxTradesPerDay}</span>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
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
                    <FormLabel>Telegram ID (Optional)</FormLabel>
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
                          min="5"
                          max="50"
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
                  name="maxTradesPerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Trades/Day - Optional</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          max="20"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-max-trades-per-day"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tradeFund"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade Fund (USDT) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="10"
                        min="100"
                        max="100000"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-trade-fund"
                      />
                    </FormControl>
                    <FormDescription>
                      Fixed amount (USDT) to use per trade. Recommended: 100-1000 USDT
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

      </TabsContent>

      <TabsContent value="applications" className="space-y-6">
        {/* Applications Section */}
        {applications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <i className="fas fa-file-alt text-4xl text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No applications yet</h3>
                  <p className="text-muted-foreground">
                    Applications will appear here when users submit them via the public form.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {applications.map((application: any) => (
              <Card key={application.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{application.name}</CardTitle>
                    <Badge variant={
                      application.status === 'pending' ? 'outline' :
                      application.status === 'approved' ? 'default' : 'destructive'
                    }>
                      {application.status}
                    </Badge>
                  </div>
                  <CardDescription>{application.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Exchange:</span> {application.exchange}
                      </div>
                      <div>
                        <span className="font-medium">Risk per Trade:</span> {application.riskPerTrade}%
                      </div>
                      <div>
                        <span className="font-medium">Max Trades/Day:</span> {application.maxTradesPerDay || 'Unlimited'}
                      </div>
                      <div>
                        <span className="font-medium">Applied:</span> {new Date(application.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {application.notes && (
                      <div>
                        <span className="font-medium text-sm">Notes:</span>
                        <p className="text-sm text-muted-foreground mt-1">{application.notes}</p>
                      </div>
                    )}
                    {application.status === 'pending' && (
                      <div className="flex space-x-2 pt-4">
                        <Button
                          onClick={() => setApprovingApplication(application)}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`button-approve-${application.id}`}
                        >
                          <i className="fas fa-check mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => setRejectingApplication(application)}
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          data-testid={`button-reject-${application.id}`}
                        >
                          <i className="fas fa-times mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <AlertDialog open={!!approvingApplication} onOpenChange={() => setApprovingApplication(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this application? This will create a new copy trading user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any notes for the approval..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approvingApplication && approveApplicationMutation.mutate({
                id: approvingApplication.id,
                notes: adminNotes
              })}
              disabled={approveApplicationMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveApplicationMutation.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Dialog */}
      <AlertDialog open={!!rejectingApplication} onOpenChange={() => setRejectingApplication(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this application? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="rejection-notes">Rejection Notes (Optional)</Label>
            <Textarea
              id="rejection-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add reason for rejection..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectingApplication && rejectApplicationMutation.mutate({
                id: rejectingApplication.id,
                notes: adminNotes
              })}
              disabled={rejectApplicationMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectApplicationMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}