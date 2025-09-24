import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Mail, Phone, Calendar, CheckCircle, Edit, Save, X } from 'lucide-react';
import { format } from 'date-fns';

interface CopyTradingUser {
  id: string;
  name: string;
  email: string;
  exchange: string;
  riskPerTrade: string;
  tradeFund: string;
  maxTradesPerDay?: number;
  isActive: boolean;
  lowFund: boolean;
  futuresWalletBalance: string;
  notes?: string;
  createdAt: string;
}

interface UserAccountSettingsProps {
  copyTradingUser: CopyTradingUser;
  onBack: () => void;
}

export function UserAccountSettings({ copyTradingUser, onBack }: UserAccountSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: copyTradingUser.name || '',
    notes: copyTradingUser.notes || '',
  });

  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['copy-trading-profile', copyTradingUser.email],
    queryFn: async () => {
      const response = await fetch(`/api/user-access/profile/${encodeURIComponent(copyTradingUser.email)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    initialData: { success: true, profile: copyTradingUser },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: typeof editForm) => {
      const response = await fetch(`/api/user-access/profile/${encodeURIComponent(copyTradingUser.email)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
        duration: 3000,
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['copy-trading-profile', copyTradingUser.email] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleCancel = () => {
    setEditForm({
      name: profileData?.profile?.name || '',
      notes: profileData?.profile?.notes || '',
    });
    setIsEditing(false);
  };

  const profile = profileData?.profile;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Campus for Wisdom branding */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white" data-testid="text-page-title">
                  Account Settings
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-user-email">
                  {profile?.email}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400" data-testid="text-brand">
                Campus For Wisdom
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Trading Community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        {error && (
          <Card className="mb-6 border-red-200 dark:border-red-800" data-testid="card-error">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <span className="text-sm">Failed to load profile information. Please try again.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Status */}
        <Card className="mb-6" data-testid="card-status">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Account Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className={`${profile?.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`} data-testid="badge-account-status">
                    {profile?.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-member-since">
                  {profile?.createdAt ? format(new Date(profile.createdAt), 'MMM dd, yyyy') : 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card data-testid="card-profile">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Profile Information</span>
                </CardTitle>
                <CardDescription>
                  Manage your personal information and contact details
                </CardDescription>
              </div>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-1"
                  data-testid="button-edit"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center space-x-1"
                    data-testid="button-cancel"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center space-x-1"
                    data-testid="button-save"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Email Address</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-gray-50 dark:bg-gray-800"
                    data-testid="input-email"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Email address cannot be changed
                  </p>
                </div>

                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter your first name"
                      data-testid="input-first-name"
                    />
                  ) : (
                    <Input
                      id="firstName"
                      type="text"
                      value={profile?.firstName || 'Not set'}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                      data-testid="display-first-name"
                    />
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      type="text"
                      value={editForm.notes}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter your last name"
                      data-testid="input-last-name"
                    />
                  ) : (
                    <Input
                      id="lastName"
                      type="text"
                      value={profile?.lastName || 'Not set'}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                      data-testid="display-last-name"
                    />
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center space-x-2">
                    <Phone className="h-4 w-4" />
                    <span>Phone Number</span>
                  </Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      type="tel"
                      value={copyTradingUser.exchange || 'Not set'} readOnly
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter your phone number"
                      data-testid="input-phone"
                    />
                  ) : (
                    <Input
                      id="phone"
                      type="tel"
                      value={profile?.phone || 'Not set'}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                      data-testid="display-phone"
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Activity */}
        <Card data-testid="card-activity">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Account Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Last Login</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-last-login">
                  {profile?.lastLoginAt 
                    ? format(new Date(profile.lastLoginAt), 'MMM dd, yyyy HH:mm')
                    : 'Never'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Account Created</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-account-created">
                  {profile?.createdAt 
                    ? format(new Date(profile.createdAt), 'MMM dd, yyyy HH:mm')
                    : 'Unknown'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}