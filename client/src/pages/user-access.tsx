import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Mail, Shield, ArrowRight, ArrowLeft, BarChart3, User, LogOut, History } from "lucide-react";
import campusLogo from "@assets/6208450096694152058_1758021301213.jpg";
import { UserTradeHistory } from "./user-trade-history";
import { UserAccountSettings } from "./user-account-settings";

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

type ViewState = 'login' | 'dashboard' | 'trade-history' | 'account-settings';

export default function UserAccessPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [currentView, setCurrentView] = useState<ViewState>('login');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [copyTradingUser, setCopyTradingUser] = useState<CopyTradingUser | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    const savedAccount = localStorage.getItem('copyTradingUser');
    if (savedEmail && savedAccount) {
      setEmail(savedEmail);
      setCopyTradingUser(JSON.parse(savedAccount));
      setCurrentView('dashboard');
    }
  }, []);

  // OTP timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user-access/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('otp');
        setOtpTimer(120); // 2 minute timer
        toast({
          title: "OTP Sent",
          description: "Please check your email for the verification code",
        });
      } else {
        throw new Error(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/user-access/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (data.success && data.copyTradingUser) {
        localStorage.setItem('userEmail', email);
        localStorage.setItem('copyTradingUser', JSON.stringify(data.copyTradingUser));
        setCopyTradingUser(data.copyTradingUser);
        setCurrentView('dashboard');
        toast({
          title: "Login Successful",
          description: data.message || "Welcome! You can now access your account.",
        });
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('copyTradingUser');
    setCopyTradingUser(null);
    setCurrentView('login');
    setStep('email');
    setEmail('');
    setOtp('');
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render different views based on current state
  if (currentView === 'trade-history' && copyTradingUser) {
    return (
      <UserTradeHistory 
        copyTradingUser={copyTradingUser} 
        onBack={() => setCurrentView('dashboard')} 
      />
    );
  }

  if (currentView === 'account-settings' && copyTradingUser) {
    return (
      <UserAccountSettings 
        copyTradingUser={copyTradingUser} 
        onBack={() => setCurrentView('dashboard')} 
      />
    );
  }

  if (currentView === 'dashboard' && copyTradingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md mx-auto pt-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <img 
                src={campusLogo} 
                alt="Campus For Wisdom" 
                className="h-16 w-16 mx-auto rounded-full object-cover"
                data-testid="img-logo"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-welcome">
              Welcome Back!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2" data-testid="text-user-email">
              {copyTradingUser.name || copyTradingUser.email}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1" data-testid="text-brand">
              Campus For Wisdom Trading Community
            </p>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-4">
                  <Button 
                    size="lg" 
                    className="w-full justify-start text-left h-auto p-4"
                    onClick={() => setCurrentView('trade-history')}
                    data-testid="button-view-trades"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
                        <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">View Trade History</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Check your trading activity</div>
                      </div>
                      <ArrowRight className="h-5 w-5 ml-auto" />
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="w-full justify-start text-left h-auto p-4"
                    onClick={() => setCurrentView('account-settings')}
                    data-testid="button-account-settings"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                        <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Account Settings</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Manage your profile</div>
                      </div>
                      <ArrowRight className="h-5 w-5 ml-auto" />
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Logout */}
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full"
              data-testid="button-logout-user"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
            <p>© 2025 Campus For Wisdom</p>
            <p>Professional Trading Platform</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <img 
              src={campusLogo} 
              alt="Campus For Wisdom" 
              className="h-16 w-16 mx-auto rounded-full object-cover"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Campus For Wisdom
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Access Your Trading Account
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {step === 'email' && <Mail className="h-5 w-5" />}
              {step === 'otp' && <Shield className="h-5 w-5" />}
              <span>
                {step === 'email' ? 'Enter Your Email' : 'Verify Your Account'}
              </span>
            </CardTitle>
            <CardDescription>
              {step === 'email' 
                ? 'Enter your email address to receive a verification code'
                : 'Enter the 6-digit code sent to your email'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'email' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendOTP()}
                    className="h-12"
                    data-testid="input-user-email"
                  />
                </div>
                <Button
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="w-full h-12"
                  data-testid="button-send-otp"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyOTP()}
                    className="h-12 text-center text-lg tracking-widest"
                    maxLength={6}
                    data-testid="input-otp-code"
                  />
                </div>
                
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Code sent to: <strong>{email}</strong>
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  disabled={isVerifying || otp.length !== 6}
                  className="w-full h-12"
                  data-testid="button-verify-otp"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Verify & Login
                    </>
                  )}
                </Button>

                {/* Resend OTP */}
                <div className="text-center">
                  {otpTimer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend code in {formatTimer(otpTimer)}
                    </p>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStep('email');
                        setOtp('');
                      }}
                      data-testid="button-resend-otp"
                    >
                      Resend Code
                    </Button>
                  )}
                </div>

                {/* Back to email */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                  }}
                  className="w-full"
                  data-testid="button-back-to-email"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Change Email
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 Campus For Wisdom</p>
          <p>Professional Trading Education Platform</p>
          <a 
            href="https://telegram.me/campusforwisdom" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Join Our Community
          </a>
        </div>
      </div>
    </div>
  );
}