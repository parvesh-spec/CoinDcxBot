import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCopyTradingApplicationSchema } from "@shared/schema";
import { z } from "zod";
import { CheckCircle, ExternalLink, Loader2, Shield, TrendingUp, Users, Zap, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import campusLogo from "@assets/6208450096694152058_1758021301213.jpg";

export default function CopyTradingApplyPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingCredentials, setIsVerifyingCredentials] = useState(false);
  const [credentialsVerified, setCredentialsVerified] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  
  // OTP verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const form = useForm<z.infer<typeof insertCopyTradingApplicationSchema>>({
    resolver: zodResolver(insertCopyTradingApplicationSchema),
    defaultValues: {
      name: "",
      email: "",
      telegramId: "", // Will be empty string for optional field
      telegramUsername: "", // Will be empty string for optional field  
      exchange: "coindcx",
      apiKey: "",
      apiSecret: "",
      riskPerTrade: 5.0,
      maxTradesPerDay: undefined,
      notes: "",
    },
  });

  // Verify credentials mutation
  const verifyCredentialsMutation = useMutation({
    mutationFn: async (data: { apiKey: string; apiSecret: string }) => {
      const response = await apiRequest("POST", "/api/public/verify-credentials", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setCredentialsVerified(true);
        toast({
          title: "✅ Credentials Verified!",
          description: "Your API credentials are valid and working.",
        });
      } else {
        setCredentialsVerified(false);
        toast({
          title: "❌ Verification Failed",
          description: data.message || "Invalid API credentials",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setCredentialsVerified(false);
      toast({
        title: "❌ Verification Error",
        description: error.message || "Failed to verify credentials",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsVerifyingCredentials(false);
    },
  });

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertCopyTradingApplicationSchema>) => {
      const response = await apiRequest("POST", "/api/public/copy-trading/applications", data);
      return response.json();
    },
    onSuccess: (data) => {
      setApplicationSubmitted(true);
      toast({
        title: "🎉 Application Submitted!",
        description: "Your copy trading application has been submitted successfully. We'll review it and get back to you soon.",
      });
      form.reset();
    },
    onError: (error: any) => {
      // Handle duplicate email errors with user-friendly message
      if (error.message && (
        error.message.includes("email already exists") || 
        error.message.includes("application with this email already exists") ||
        error.message.includes("user with this email already exists")
      )) {
        toast({
          title: "📧 Email Already Registered",
          description: "This email is already registered in our system. Please use a different email address.",
          variant: "destructive",
        });
      } else {
        // Generic error message for other errors
        toast({
          title: "❌ Submission Failed",
          description: error.message || "Failed to submit application",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/public/otp/send", {
        email,
        purpose: "application_submission"
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setOtpSent(true);
        setOtpTimer(120); // 2 minutes countdown
        toast({
          title: "📧 OTP Sent!",
          description: "Please check your email for the 6-digit verification code.",
        });
        
        // Start countdown timer
        const interval = setInterval(() => {
          setOtpTimer((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({
          title: "❌ Failed to Send OTP",
          description: data.message || "Unable to send OTP to your email",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ OTP Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSendingOtp(false);
    },
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { email: string; otp: string }) => {
      const response = await apiRequest("POST", "/api/public/otp/verify", {
        email: data.email,
        otp: data.otp,
        purpose: "application_submission"
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.verified) {
        setEmailVerified(true);
        setOtpTimer(0);
        toast({
          title: "✅ Email Verified!",
          description: "Your email has been successfully verified.",
        });
      } else {
        toast({
          title: "❌ Invalid OTP",
          description: data.message || "The OTP code is incorrect or expired",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Verification Failed",
        description: error.message || "Failed to verify OTP",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsVerifyingOtp(false);
    },
  });

  const handleSendOtp = () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }
    
    setIsSendingOtp(true);
    sendOtpMutation.mutate(email);
  };

  const handleVerifyOtp = () => {
    const email = form.getValues("email");
    if (!email || !otpCode) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and OTP code",
        variant: "destructive",
      });
      return;
    }
    
    setIsVerifyingOtp(true);
    verifyOtpMutation.mutate({ email, otp: otpCode });
  };

  const handleVerifyCredentials = () => {
    const apiKey = form.getValues("apiKey");
    const apiSecret = form.getValues("apiSecret");
    
    if (!apiKey || !apiSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both API Key and API Secret",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingCredentials(true);
    verifyCredentialsMutation.mutate({ apiKey, apiSecret });
  };

  const onSubmit = (values: z.infer<typeof insertCopyTradingApplicationSchema>) => {
    if (!emailVerified) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email address before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!credentialsVerified) {
      toast({
        title: "Verification Required",
        description: "Please verify your API credentials before submitting",
        variant: "destructive",
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: "Terms & Conditions Required",
        description: "Please accept the terms and conditions before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    submitApplicationMutation.mutate(values);
  };

  const handleRiskPerTradeChange = (value: number) => {
    if (value > 10) {
      setShowRiskWarning(true);
    } else {
      setShowRiskWarning(false);
    }
    return value;
  };

  if (applicationSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <img 
                  src={campusLogo} 
                  alt="Campus For Wisdom" 
                  className="h-20 w-20 object-cover rounded-full"
                  data-testid="campus-logo"
                />
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    Campus For Wisdom
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Professional Copy Trading Platform
                  </p>
                </div>
              </div>
              
              <a
                href="https://telegram.me/campusforwisdom"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
                data-testid="cta-join-community"
              >
                <span className="text-sm">Join Free Community</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-md mx-auto">
            <Card className="text-center">
              <CardContent className="pt-8 pb-8">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Application Submitted!
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Thank you for applying to our copy trading program. Our team will review your application and contact you within 24-48 hours.
                </p>
                <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <p>✅ Credentials verified</p>
                  <p>✅ Application submitted</p>
                  <p>⏳ Admin review pending</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src={campusLogo} 
                alt="Campus For Wisdom" 
                className="h-20 w-20 object-cover rounded-full"
                data-testid="campus-logo"
              />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  Campus For Wisdom
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Professional Copy Trading Platform
                </p>
              </div>
            </div>
            
            <a
              href="https://telegram.me/campusforwisdom"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
              data-testid="cta-join-community"
            >
              <span className="text-sm">Join Free Community</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Join Our Copy Trading Program
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            Get your trades automatically copied to profitable opportunities. Our expert traders have a proven track record of consistent returns.
          </p>
          
          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Proven Performance</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Consistent profitable trades with risk management</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <Shield className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Secure & Automated</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Your funds stay in your account, we just copy signals</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <Users className="h-8 w-8 text-purple-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Expert Support</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">24/7 support and guidance from trading experts</p>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Apply for Copy Trading</CardTitle>
              <CardDescription className="text-center">
                Fill out the form below and we'll review your application within 24-48 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2">
                      Personal Information
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
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
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="john@example.com" 
                                {...field} 
                                data-testid="input-email"
                                onChange={(e) => {
                                  // Reset email verification when email changes
                                  if (emailVerified && e.target.value !== field.value) {
                                    setEmailVerified(false);
                                    setOtpSent(false);
                                    setOtpCode('');
                                    setOtpTimer(0);
                                  }
                                  field.onChange(e); // Call the original onChange
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Email Verification Section */}
                    {!emailVerified && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                📧 Email Verification Required
                              </h4>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                We'll send a 6-digit code to verify your email address
                              </p>
                            </div>
                            <div className="text-right">
                              {!otpSent ? (
                                <Button
                                  type="button"
                                  onClick={handleSendOtp}
                                  disabled={isSendingOtp || !form.getValues("email")}
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                  data-testid="button-send-otp"
                                >
                                  {isSendingOtp ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-paper-plane mr-2" />
                                      Send OTP
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                                  </div>
                                  <div className="text-xs text-blue-500 dark:text-blue-400">
                                    Resend available in
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {otpSent && (
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor="otp-code" className="text-sm font-medium">
                                  Enter 6-digit Code
                                </Label>
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    id="otp-code"
                                    type="text"
                                    placeholder="123456"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    className="text-center text-lg font-mono tracking-widest"
                                    data-testid="input-otp-code"
                                  />
                                  <Button
                                    type="button"
                                    onClick={handleVerifyOtp}
                                    disabled={isVerifyingOtp || otpCode.length !== 6}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    data-testid="button-verify-otp"
                                  >
                                    {isVerifyingOtp ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Verifying...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Verify
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Check your email (including spam folder)
                                </p>
                                {otpTimer === 0 && (
                                  <Button
                                    type="button"
                                    onClick={handleSendOtp}
                                    disabled={isSendingOtp}
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700"
                                    data-testid="button-resend-otp"
                                  >
                                    Resend OTP
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Verified Success */}
                    {emailVerified && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
                          <div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                              ✅ Email Verified Successfully
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              Your email address has been verified
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            setEmailVerified(false);
                            setOtpSent(false);
                            setOtpCode('');
                            setOtpTimer(0);
                          }}
                          variant="outline"
                          size="sm"
                          className="text-green-700 hover:text-green-800 border-green-300 hover:border-green-400"
                          data-testid="button-change-email"
                        >
                          <i className="fas fa-edit mr-2" />
                          Change Email
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Exchange Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2">
                      Exchange & API Credentials
                    </h3>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Security Notice</span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        Your API credentials are encrypted and stored securely. <strong>Important:</strong> Enable trading permissions but DO NOT enable withdrawal permissions for maximum security.
                      </p>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="exchange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exchange *</FormLabel>
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

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key *</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Your API Key"
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
                            <FormLabel>API Secret *</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Your API Secret"
                                {...field}
                                data-testid="input-api-secret"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Credential Verification */}
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          Credential Verification
                        </span>
                        {credentialsVerified && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        We'll verify your API credentials to ensure they're valid before processing your application.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyCredentials}
                        disabled={isVerifyingCredentials || credentialsVerified}
                        className="w-full md:w-auto"
                        data-testid="button-verify-credentials"
                      >
                        {isVerifyingCredentials ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : credentialsVerified ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                          <Shield className="h-4 w-4 mr-2" />
                        )}
                        {isVerifyingCredentials ? "Verifying..." : credentialsVerified ? "Verified" : "Verify Credentials"}
                      </Button>
                    </div>
                  </div>

                  {/* Trading Settings */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 border-b pb-2">
                      Trading Preferences
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
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
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  field.onChange(value);
                                  handleRiskPerTradeChange(value);
                                }}
                                data-testid="input-risk-per-trade"
                              />
                            </FormControl>
                            <FormDescription>Percentage of balance to risk per trade (5% - 50%)</FormDescription>
                            {showRiskWarning && (
                              <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  <strong>High Risk Warning:</strong> Risk above 10% can lead to significant losses. Please consider lower values for safer trading.
                                </p>
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxTradesPerDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Trades per Day (Optional)</FormLabel>
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
                            <FormDescription>
                              Limit daily trades (e.g., 2 = only first 2 trades copied each day)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us about your trading experience, goals, or any specific requirements..."
                            {...field}
                            value={field.value || ""}
                            rows={4}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms & Conditions */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                        className="mt-1"
                        data-testid="checkbox-terms"
                      />
                      <div className="space-y-1">
                        <label
                          htmlFor="terms"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          I accept the Terms & Conditions *
                        </label>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          I understand that trading involves risks and Campus For Wisdom is not responsible for any trading losses. All investments are subject to market risks.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting || !emailVerified || !credentialsVerified || !acceptedTerms}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all duration-200"
                    data-testid="button-submit-application"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-5 w-5 mr-2" />
                    )}
                    {isSubmitting ? "Submitting Application..." : "Submit Application"}
                  </Button>

                  {!credentialsVerified && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                      Please verify your API credentials before submitting your application
                    </p>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            © 2025 Campus For Wisdom. Professional trading education and copy trading platform.
          </p>
        </div>
      </div>
    </div>
  );
}