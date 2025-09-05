import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/trades/stats"],
    retry: false,
  });

  const cardData = [
    {
      title: "Total Trades",
      value: (stats as any)?.total || 0,
      icon: "fas fa-chart-bar",
      color: "text-primary",
      testId: "stat-total-trades",
    },
    {
      title: "Posted Successfully",
      value: (stats as any)?.posted || 0,
      icon: "fas fa-check-circle",
      color: "text-green-500",
      testId: "stat-posted-trades",
    },
    {
      title: "Pending",
      value: (stats as any)?.pending || 0,
      icon: "fas fa-clock",
      color: "text-yellow-500",
      testId: "stat-pending-trades",
    },
    {
      title: "Failed",
      value: (stats as any)?.failed || 0,
      icon: "fas fa-exclamation-triangle",
      color: "text-red-500",
      testId: "stat-failed-trades",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {cardData.map((card) => (
        <Card key={card.title} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className={`${card.icon} h-8 w-8 ${card.color}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted-foreground truncate">
                    {card.title}
                  </dt>
                  <dd className="text-2xl font-semibold text-foreground" data-testid={card.testId}>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      card.value.toLocaleString()
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
