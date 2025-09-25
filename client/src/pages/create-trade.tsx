import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Plus } from 'lucide-react';

// Manual trade creation schema - simplified
const createTradeSchema = z.object({
  pair: z.string().min(1, "Trading pair is required"),
  type: z.enum(['buy', 'sell'], { required_error: "Trade type is required" }),
  price: z.string().min(1, "Price is required"),
  leverage: z.coerce.number().min(1, "Leverage must be at least 1").max(1000, "Leverage cannot exceed 1000"),
  takeProfitTrigger: z.string().optional(),
  takeProfit2: z.string().optional(),
  takeProfit3: z.string().optional(),
  stopLossTrigger: z.string().optional(),
  signalType: z.enum(['intraday', 'swing', 'scalp', 'positional'], { required_error: "Signal type is required" }),
  notes: z.string().optional(),
});

type CreateTradeFormData = z.infer<typeof createTradeSchema>;

interface CreateTradePageProps {
  onBack: () => void;
}

export default function CreateTradePage({ onBack }: CreateTradePageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateTradeFormData>({
    resolver: zodResolver(createTradeSchema),
    defaultValues: {
      type: 'buy',
      signalType: 'intraday',
      leverage: 1,
    },
  });

  const createTradeMutation = useMutation({
    mutationFn: async (data: CreateTradeFormData) => {
      const response = await apiRequest('POST', '/api/trades', data);
      return response.json();
    },
    onSuccess: (newTrade: any) => {
      toast({
        title: "Trade Created",
        description: `Trade ${newTrade.pair} created successfully.`,
      });
      
      // Invalidate trades query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      
      // Reset form
      form.reset();
      
      // Go back to trades list
      onBack();
    },
    onError: (error: any) => {
      console.error('Create trade error:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create trade. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateTradeFormData) => {
    console.log('Creating trade:', data);
    createTradeMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            onClick={onBack}
            variant="outline" 
            size="sm"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trades
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create New Trade</h1>
            <p className="text-muted-foreground">Add a trade manually or via API</p>
          </div>
        </div>

        {/* Trade Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Trade Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Trading Pair */}
                  <FormField
                    control={form.control}
                    name="pair"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trading Pair *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., BTC_USDT"
                            data-testid="input-pair"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Trade Type */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
                              <SelectValue placeholder="Select trade type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="buy">BUY</SelectItem>
                            <SelectItem value="sell">SELL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price */}
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.00000001"
                            placeholder="Enter price"
                            data-testid="input-price"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Leverage */}
                  <FormField
                    control={form.control}
                    name="leverage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Leverage *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            min="1"
                            max="1000"
                            placeholder="Enter leverage"
                            data-testid="input-leverage"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Signal Type */}
                  <FormField
                    control={form.control}
                    name="signalType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signal Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-signal-type">
                              <SelectValue placeholder="Select signal type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="intraday">Intraday</SelectItem>
                            <SelectItem value="swing">Swing</SelectItem>
                            <SelectItem value="scalp">Scalp</SelectItem>
                            <SelectItem value="positional">Positional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Optional Fields Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Optional Fields</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Stop Loss */}
                    <FormField
                      control={form.control}
                      name="stopLossTrigger"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stop Loss</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.00000001"
                              placeholder="Enter stop loss price"
                              data-testid="input-stop-loss"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Take Profit 1 */}
                    <FormField
                      control={form.control}
                      name="takeProfitTrigger"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Take Profit 1</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.00000001"
                              placeholder="Enter take profit 1 price"
                              data-testid="input-take-profit-1"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Take Profit 2 */}
                    <FormField
                      control={form.control}
                      name="takeProfit2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Take Profit 2</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.00000001"
                              placeholder="Enter take profit 2 price"
                              data-testid="input-take-profit-2"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Take Profit 3 */}
                    <FormField
                      control={form.control}
                      name="takeProfit3"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Take Profit 3</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.00000001"
                              placeholder="Enter take profit 3 price"
                              data-testid="input-take-profit-3"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter any additional notes..."
                            className="min-h-[100px]"
                            data-testid="input-notes"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onBack}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTradeMutation.isPending}
                    data-testid="button-create-trade"
                  >
                    {createTradeMutation.isPending ? "Creating..." : "Create Trade"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}