import { useEffect, useRef } from 'react';
import { YearlyPnLHeatmap } from '@/components/calendar/YearlyPnLHeatmap';
import type { Trade } from '@shared/schema';

interface HeatmapWidgetProps {
  trades: Trade[];
  scale?: number;
  clickTarget?: string;
  theme?: 'light' | 'dark';
}

export function HeatmapWidget({ 
  trades, 
  scale = 1.0, 
  clickTarget,
  theme = 'light' 
}: HeatmapWidgetProps) {
  // Safe default for click target
  const safeClickTarget = clickTarget || (typeof window !== 'undefined' ? window.location.origin + '/trade-history' : '/trade-history');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize functionality via postMessage
  useEffect(() => {
    const sendHeight = () => {
      if (containerRef.current && window.parent !== window) {
        const height = containerRef.current.scrollHeight;
        window.parent.postMessage({
          type: 'cfw:heatmap:resize',
          height: height + 20 // Add some padding
        }, '*');
      }
    };

    // Send height on mount and when content changes
    sendHeight();
    
    // Also send on window resize
    window.addEventListener('resize', sendHeight);
    
    // Observer for content changes
    const observer = new ResizeObserver(sendHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', sendHeight);
      observer.disconnect();
    };
  }, [trades]);

  // Handle click navigation
  const handleClick = () => {
    try {
      // Build URL safely
      let fullUrl: string;
      
      if (safeClickTarget.startsWith('http')) {
        // Absolute URL - use as is
        const url = new URL(safeClickTarget);
        url.searchParams.set('utm_source', 'widget');
        url.searchParams.set('utm_medium', 'embed');
        url.searchParams.set('utm_campaign', 'heatmap');
        fullUrl = url.toString();
      } else {
        // Relative URL - always use the trade history app domain, not parent page origin
        // This ensures clicks from external sites always go to our trade history app
        const widgetOrigin = 'https://trade.campusforwisdom.com';
          
        const url = new URL(safeClickTarget, widgetOrigin);
        url.searchParams.set('utm_source', 'widget');
        url.searchParams.set('utm_medium', 'embed');
        url.searchParams.set('utm_campaign', 'heatmap');
        fullUrl = url.toString();
      }
      
      // Try to navigate parent window
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'cfw:heatmap:click',
          url: fullUrl
        }, '*');
        
        // Fallback: try direct navigation
        setTimeout(() => {
          try {
            window.parent.location.href = fullUrl;
          } catch (err) {
            // If cross-origin, open in new tab
            window.open(fullUrl, '_blank');
          }
        }, 100);
      } else {
        window.location.href = fullUrl;
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: open in new tab
      try {
        window.open(safeClickTarget, '_blank');
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`${theme === 'dark' ? 'dark' : ''} cursor-pointer transition-opacity hover:opacity-90`}
      onClick={handleClick}
      style={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${100 / scale}%`
      }}
      data-testid="heatmap-widget"
    >
      <div className="bg-white dark:bg-slate-900 min-h-screen p-4">
        <YearlyPnLHeatmap 
          trades={trades} 
          className="max-w-4xl mx-auto"
        />
        
        {/* Overlay hint for interactivity */}
        <div className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Click to view full trading history →
        </div>
      </div>
    </div>
  );
}