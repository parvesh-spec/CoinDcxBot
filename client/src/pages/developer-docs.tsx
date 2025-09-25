import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeveloperDocsProps {
  onBack: () => void;
}

export default function DeveloperDocsPage({ onBack }: DeveloperDocsProps) {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch API key
  const { data: apiKeyData, isLoading: apiKeyLoading, refetch: refetchApiKey } = useQuery({
    queryKey: ["api-key"],
    queryFn: async () => {
      const response = await fetch("/api/developer/api-key");
      if (!response.ok) throw new Error("Failed to fetch API key");
      return response.json();
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard",
    });
  };

  const generateNewApiKey = async () => {
    try {
      const response = await fetch("/api/developer/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to generate API key");
      
      refetchApiKey();
      toast({
        title: "Success",
        description: "New API key generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate new API key",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Trades
        </Button>
        <h1 className="text-3xl font-bold">Developer Documentation</h1>
        <p className="text-muted-foreground mt-2">
          API documentation for external trade registration
        </p>
      </div>

      {/* API Key Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium">Your API Key</label>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex-1 p-2 bg-muted rounded border font-mono text-sm">
                    {apiKeyLoading ? (
                      "Loading..."
                    ) : showApiKey ? (
                      apiKeyData?.apiKey || "No API key found"
                    ) : (
                      "••••••••••••••••••••••••••••••••"
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    data-testid="button-toggle-api-key"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apiKeyData?.apiKey || "")}
                    disabled={!apiKeyData?.apiKey}
                    data-testid="button-copy-api-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={generateNewApiKey}
                disabled={apiKeyLoading}
                data-testid="button-generate-api-key"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New Key
              </Button>
              <Badge variant="destructive">
                Warning: Generating a new key will invalidate the current one
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trade Registration API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Endpoint */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Endpoint</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm">
                <Badge variant="secondary" className="mr-2">POST</Badge>
                {window.location.origin}/api/trades
              </div>
            </div>

            {/* Headers */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Headers</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm">
                Content-Type: application/json<br/>
                Authorization: Bearer YOUR_API_KEY
              </div>
            </div>

            {/* Request Body */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Request Body</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm overflow-x-auto">
                <pre>{JSON.stringify({
                  symbol: "BTCUSDT",
                  side: "BUY",
                  quantity: 0.001,
                  entryPrice: 45000,
                  targets: [46000, 47000, 48000],
                  stopLoss: 44000,
                  source: "api", // or "manual"
                  signalType: "intraday" // "intraday", "scalping", "swing", "positional"
                }, null, 2)}</pre>
              </div>
            </div>

            {/* Response */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Response</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm overflow-x-auto">
                <pre>{JSON.stringify({
                  success: true,
                  trade: {
                    id: "uuid",
                    symbol: "BTCUSDT",
                    side: "BUY",
                    quantity: 0.001,
                    entryPrice: 45000,
                    targets: [46000, 47000, 48000],
                    stopLoss: 44000,
                    source: "api",
                    signalType: "intraday",
                    status: "active",
                    createdAt: "2025-09-25T12:00:00Z"
                  }
                }, null, 2)}</pre>
              </div>
            </div>

            {/* Field Descriptions */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Field Descriptions</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>symbol</strong>
                  <span>string</span>
                  <span>Trading pair (e.g., BTCUSDT)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>side</strong>
                  <span>string</span>
                  <span>BUY or SELL</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>quantity</strong>
                  <span>number</span>
                  <span>Trade quantity</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>entryPrice</strong>
                  <span>number</span>
                  <span>Entry price for the trade</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>targets</strong>
                  <span>number[]</span>
                  <span>Array of target prices (max 5)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>stopLoss</strong>
                  <span>number</span>
                  <span>Stop loss price</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2 border-b">
                  <strong>source</strong>
                  <span>string</span>
                  <span>"api" or "manual"</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2">
                  <strong>signalType</strong>
                  <span>string</span>
                  <span>"intraday", "scalping", "swing", "positional"</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Code Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* JavaScript/Node.js Example */}
            <div>
              <h3 className="text-lg font-semibold mb-2">JavaScript/Node.js</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm overflow-x-auto">
                <pre>{`const response = await fetch('${window.location.origin}/api/trades', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 0.001,
    entryPrice: 45000,
    targets: [46000, 47000, 48000],
    stopLoss: 44000,
    source: 'api',
    signalType: 'intraday'
  })
});

const result = await response.json();
console.log(result);`}</pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToClipboard(`const response = await fetch('${window.location.origin}/api/trades', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 0.001,
    entryPrice: 45000,
    targets: [46000, 47000, 48000],
    stopLoss: 44000,
    source: 'api',
    signalType: 'intraday'
  })
});

const result = await response.json();
console.log(result);`)}
                data-testid="button-copy-js-example"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>

            {/* Python Example */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Python</h3>
              <div className="bg-muted p-3 rounded font-mono text-sm overflow-x-auto">
                <pre>{`import requests
import json

url = '${window.location.origin}/api/trades'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
}
data = {
    'symbol': 'BTCUSDT',
    'side': 'BUY',
    'quantity': 0.001,
    'entryPrice': 45000,
    'targets': [46000, 47000, 48000],
    'stopLoss': 44000,
    'source': 'api',
    'signalType': 'intraday'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)`}</pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => copyToClipboard(`import requests
import json

url = '${window.location.origin}/api/trades'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
}
data = {
    'symbol': 'BTCUSDT',
    'side': 'BUY',
    'quantity': 0.001,
    'entryPrice': 45000,
    'targets': [46000, 47000, 48000],
    'stopLoss': 44000,
    'source': 'api',
    'signalType': 'intraday'
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)`)}
                data-testid="button-copy-python-example"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}