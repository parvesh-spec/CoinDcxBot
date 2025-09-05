import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center">
              <i className="fas fa-robot text-4xl text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">CoinDCX Telegram Bot</CardTitle>
          <CardDescription>
            Admin Dashboard for managing your trading notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Integrate your CoinDCX trades with Telegram channels automatically
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <i className="fas fa-chart-line text-primary" />
              <span className="text-sm">Real-time trade monitoring</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-paper-plane text-primary" />
              <span className="text-sm">Automatic Telegram posting</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-edit text-primary" />
              <span className="text-sm">Customizable message templates</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-shield-alt text-primary" />
              <span className="text-sm">Secure API integration</span>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            <i className="fas fa-sign-in-alt mr-2" />
            Login to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
