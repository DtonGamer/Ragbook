import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CreditsDisplay() {
  const navigate = useNavigate();
  const { isPro, creditsLeft, creditsMax, creditsPercentage, isLoading, subscription } = useSubscription();

  // Show loading state while fetching OR if subscription data hasn't loaded yet
  if (isLoading || !subscription) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <span className="text-sm text-white/70">Loading...</span>
      </div>
    );
  }

  const getStatusColor = () => {
    if (isPro) return "text-yellow-400";
    if (creditsPercentage > 50) return "text-green-400";
    if (creditsPercentage > 20) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressColor = () => {
    if (isPro) return "bg-yellow-400";
    if (creditsPercentage > 50) return "bg-green-400";
    if (creditsPercentage > 20) return "bg-yellow-400";
    return "bg-red-400";
  };

  return (
    <div className="space-y-3">
      {/* Plan Badge */}
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-help ${
                  isPro
                    ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black border-transparent"
                    : "bg-white/10 text-white border border-white/20"
                }`}
              >
                {isPro ? (
                  <>
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Free
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPro ? "Pro Plan - Unlimited Access" : "Free Plan - Limited Credits"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!isPro && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10"
            onClick={() => navigate("/pricing")}
          >
            Upgrade
          </Button>
        )}
      </div>

      {/* Credits Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Credits</span>
          <span className={`font-semibold ${getStatusColor()}`}>
            {creditsLeft} / {creditsMax}
          </span>
        </div>

        {!isPro && (
          <Progress
            value={creditsPercentage}
            className="h-2 bg-white/10"
            indicatorClassName={getProgressColor()}
          />
        )}

        {isPro && (
          <div className="text-xs text-yellow-400 flex items-center gap-1">
            <Crown className="h-3 w-3" />
            <span>Unlimited access</span>
          </div>
        )}
      </div>

      {/* Low Credits Warning */}
      {!isPro && creditsLeft < 10 && creditsLeft > 0 && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
          <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-400">
            <p className="font-semibold">Running low on credits!</p>
            <p className="text-yellow-400/80">
              Upgrade to Pro for unlimited access
            </p>
          </div>
        </div>
      )}

      {/* No Credits Warning */}
      {!isPro && creditsLeft === 0 && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-400/10 border border-red-400/20">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-400">
            <p className="font-semibold">Out of credits!</p>
            <Button
              size="sm"
              className="mt-2 w-full bg-red-400 hover:bg-red-500 text-white"
              onClick={() => navigate("/pricing")}
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
