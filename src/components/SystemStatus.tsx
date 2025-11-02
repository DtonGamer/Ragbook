import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { CreditCard, HardDrive, Sparkles, Zap } from "lucide-react";

interface SystemStatusProps {
  className?: string;
}

export const SystemStatus = ({ className }: SystemStatusProps) => {
  const { creditsLeft, creditsMax, creditsPercentage, isPro } = useSubscription();

  const stats = [
    {
      title: "Credits Remaining",
      value: `${creditsLeft}/${creditsMax}`,
      icon: CreditCard,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Credit Usage",
      value: `${Math.round(creditsPercentage)}%`,
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Plan",
      value: isPro ? "Pro" : "Free",
      icon: Sparkles,
      color: isPro ? "text-yellow-500" : "text-gray-500",
      bgColor: isPro ? "bg-yellow-500/10" : "bg-gray-500/10",
    },
    {
      title: "Storage",
      value: "1.2 GB",
      icon: HardDrive,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="list">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="hover:shadow-md transition-shadow"
              role="listitem"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`} aria-label={stat.title}>
                  <Icon className={`w-4 h-4 ${stat.color}`} aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.title === "Credit Usage" && (
                  <div className="mt-2">
                    <Progress 
                      value={creditsPercentage} 
                      className="h-2" 
                      aria-label={`${Math.round(creditsPercentage)}% credit usage`}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};