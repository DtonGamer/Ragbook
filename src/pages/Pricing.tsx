import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { ArrowLeft, Check, Crown, Zap, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPricingConfig, PricingConfig } from "@/config/pricingConfig";

declare global {
  interface Window {
    MonnifySDK: any;
  }
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { subscription, isPro, creditsLeft, creditsMax, refreshSubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch pricing configuration on component mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const config = await getPricingConfig();
        setPricingConfig(config);
      } catch (error) {
        console.error('Failed to load pricing configuration:', error);
        toast.error('Failed to load pricing information. Using default values.');
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, []);

  // Page entrance animation
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleUpgrade = () => {
    if (!user) {
      toast.error("Please sign in to upgrade");
      navigate("/auth");
      return;
    }

    if (!pricingConfig) {
      toast.error("Pricing information not loaded yet");
      return;
    }

    setIsProcessing(true);

    // Get the Pro plan from the configuration
    const proPlan = pricingConfig.plans.find(plan => plan.id === 'pro');
    if (!proPlan) {
      console.error('Pro plan not found in pricing configuration');
      toast.error("Failed to initialize payment");
      setIsProcessing(false);
      return;
    }

    try {
      // Initialize Monnify payment
      const monnifyConfig = {
        amount: proPlan.price / 100, // Monnify uses actual amount (not in kobo like Paystack)
        currency: proPlan.currency, // Use the currency from the configuration
        reference: `${Date.now()}-${user.id}`,
        customerName: user.user_metadata?.full_name || user.email.split('@')[0],
        customerEmail: user.email,
        customerPhoneNumber: user.phone || "", // Optional
        contractCode: import.meta.env.VITE_MONNIFY_CONTRACT_CODE,
        onSuccess: (response: any) => {
          console.log('Payment successful:', response);
          setIsProcessing(false);
          setShowSuccessModal(true);

          // Wait a moment for webhook to process
          setTimeout(() => {
            // Call refreshSubscription without await since callback can't be async
            refreshSubscription();
          }, 2000);
        },
        onCancel: (response: any) => {
          console.log('Payment cancelled:', response);
          setIsProcessing(false);
          toast.info("Payment cancelled");
        },
        onError: (response: any) => {
          console.log('Payment error:', response);
          setIsProcessing(false);
          toast.error("Payment failed. Please try again.");
        }
      };

      // @ts-ignore - MonnifySDK should be available after script loads in index.html
      const monnify = new window.MonnifySDK(monnifyConfig);
      monnify.initialize();
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast.error("Failed to initialize payment");
      setIsProcessing(false);
    }
  };

  return (
    <ResponsiveLayout showSidebar={false}>
      <div className={`h-full flex flex-col transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}>
        {/* Simple Back Button for Desktop - Fixed at top */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="transition-smooth hover:scale-102 active:scale-98"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-12 custom-scrollbar">
          {/* Hero Section */}
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8 lg:mb-12">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 text-foreground">
                Choose Your Plan
              </h2>
              <p className="text-muted-foreground text-sm md:text-base lg:text-lg max-w-prose mx-auto">
                Unlock the full power of RAG Book with features designed for serious learners
              </p>
            </div>

            {/* Current Usage */}
            {subscription && (
              <div className="max-w-2xl mx-auto mb-8 lg:mb-12 rounded-2xl border border-border/50 bg-card/50 p-4 lg:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base lg:text-lg font-semibold text-foreground">Current Usage</h3>
                  <Badge variant={isPro ? "default" : "secondary"} className="text-xs lg:text-sm">
                    {isPro ? "Pro" : "Free"} Plan
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-muted-foreground">Credits Remaining</span>
                  <span className="text-lg lg:text-xl font-bold text-foreground">
                    {creditsLeft} / {creditsMax}
                  </span>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                    style={{ width: `${(creditsLeft / creditsMax) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pricing Cards */}
            <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 max-w-5xl mx-auto mb-8 lg:mb-12 transition-all duration-500 delay-200">
              {!loading && pricingConfig ? (
                pricingConfig.plans.map((plan) => {
                  const isFreePlan = plan.id === 'free';
                  const isProPlan = plan.id === 'pro';
                  const isRecommended = plan.recommended;
                  
                  return (
                    <div 
                      key={plan.id}
                      className={`rounded-2xl ${
                        isRecommended 
                          ? 'border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5 p-5 lg:p-6 shadow-lg relative' 
                          : 'border border-border/50 bg-card/50 p-5 lg:p-6 shadow-sm'
                      } transition-all duration-300 hover:shadow-lg hover:border-border hover:scale-[1.02] hover:-translate-y-1`}
                    >
                      {isRecommended && (
                        <div className="absolute -top-2.5 lg:-top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground font-bold px-3 lg:px-4 py-1 shadow-md text-xs">
                            RECOMMENDED
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-4 mt-2.5 lg:mt-0">
                        <div>
                          <h3 className="text-xl lg:text-2xl font-bold text-foreground mb-1">{plan.name}</h3>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {isFreePlan 
                              ? 'Get started with basic features' 
                              : 'Unlimited power for serious students'
                            }
                          </p>
                        </div>
                        <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg ${
                          isRecommended 
                            ? 'bg-primary flex items-center justify-center shadow-sm shadow-primary/20' 
                            : 'bg-primary/10 flex items-center justify-center'
                        } shrink-0`}>
                          {plan.icon === 'zap' ? (
                            <Zap className={`w-5 h-5 lg:w-6 lg:h-6 ${
                              isRecommended ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          ) : plan.icon === 'crown' ? (
                            <Crown className={`w-5 h-5 lg:w-6 lg:h-6 ${
                              isRecommended ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          ) : null}
                        </div>
                      </div>
                      
                      <div className="mb-4 lg:mb-6">
                        <span className="text-3xl lg:text-4xl font-extrabold text-foreground">
                          ₦{plan.price / 100}{plan.creditsFrequency === 'month' ? '' : ''}
                        </span>
                        <span className="text-muted-foreground text-sm lg:text-base ml-2">
                          {plan.creditsFrequency === 'month' ? '/month' : ''}
                        </span>
                      </div>

                      <ul className="space-y-2.5 lg:space-y-3 mb-4 lg:mb-6">
                        <li className="flex items-start gap-2.5 lg:gap-3">
                          <div className={`w-5 h-5 rounded-full ${
                            isRecommended 
                              ? 'bg-primary flex items-center justify-center' 
                              : 'bg-primary/10 flex items-center justify-center'
                          } shrink-0 mt-0.5`}>
                            <Check className={`w-3 h-3 ${
                              isRecommended ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <span className={`text-xs lg:text-sm ${
                            isRecommended ? 'font-semibold text-foreground' : 'text-foreground'
                          }`}>
                            {plan.credits} credits{plan.creditsFrequency === 'month' ? '/month' : ' (one-time)'}
                          </span>
                        </li>
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2.5 lg:gap-3">
                            <div className={`w-5 h-5 rounded-full ${
                              isRecommended 
                                ? 'bg-primary flex items-center justify-center' 
                                : 'bg-primary/10 flex items-center justify-center'
                            } shrink-0 mt-0.5`}>
                              <Check className={`w-3 h-3 ${
                                isRecommended ? 'text-primary-foreground' : 'text-primary'
                              }`} />
                            </div>
                            <span className={`text-xs lg:text-sm ${
                              isRecommended ? 'font-semibold text-foreground' : 'text-foreground'
                            }`}>
                              {feature}
                            </span>
                          </li>
                        ))}
                        <li className="flex items-start gap-2.5 lg:gap-3">
                          <div className={`w-5 h-5 rounded-full ${
                            isRecommended 
                              ? 'bg-primary flex items-center justify-center' 
                              : 'bg-primary/10 flex items-center justify-center'
                          } shrink-0 mt-0.5`}>
                            <Check className={`w-3 h-3 ${
                              isRecommended ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <span className={`text-xs lg:text-sm ${
                            isRecommended ? 'font-semibold text-foreground' : 'text-foreground'
                          }`}>
                            Max file size: {plan.maxFileSize}
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5 lg:gap-3">
                          <div className={`w-5 h-5 rounded-full ${
                            isRecommended 
                              ? 'bg-primary flex items-center justify-center' 
                              : 'bg-primary/10 flex items-center justify-center'
                          } shrink-0 mt-0.5`}>
                            <Check className={`w-3 h-3 ${
                              isRecommended ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          </div>
                          <span className={`text-xs lg:text-sm ${
                            isRecommended ? 'font-semibold text-foreground' : 'text-foreground'
                          }`}>
                            {plan.processingQueue.charAt(0).toUpperCase() + plan.processingQueue.slice(1)} processing queue
                          </span>
                        </li>
                      </ul>

                      <Button
                        className="w-full transition-smooth hover:scale-102 active:scale-98 text-sm lg:text-base touch-manipulation"
                        onClick={isProPlan ? handleUpgrade : undefined}
                        disabled={isProPlan ? (isPro || isProcessing) : !isFreePlan}
                        variant={isRecommended ? undefined : "outline"}
                      >
                        {isProPlan && isPro ? "✓ Current Plan" : 
                         isProPlan && isProcessing ? "Processing..." : 
                         isProPlan ? "Upgrade to Pro" : 
                         isFreePlan ? (isPro ? "Current Plan" : "Active Plan") : ""}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                All plans include secure document storage, AI-powered chat, and regular updates.
                <br />
                Cancel anytime. No hidden fees.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 py-4 lg:py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} RAG BOOK
        </footer>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center animate-in zoom-in duration-300">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center text-2xl">
              Welcome to Pro! 🎉
            </DialogTitle>
            <DialogDescription className="text-center">
              Your account has been successfully upgraded. You now have access to all Pro features!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {pricingConfig?.successMessages?.map((message, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-primary/10">
                <Check className="w-5 h-5 text-primary" />
                <span className="text-sm">{message}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              setShowSuccessModal(false);
              navigate("/chat");
            }}
            className="w-full transition-smooth hover:scale-102 active:scale-98"
          >
            Start Chatting
          </Button>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}