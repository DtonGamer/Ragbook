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
import { CreditCard, Crown, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CreditUpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade?: () => void;
}

export const CreditUpgradePrompt = ({ 
  open, 
  onOpenChange, 
  onUpgrade 
}: CreditUpgradePromptProps) => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { creditsLeft, creditsMax, isPro } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgrade = () => {
    if (!user) {
      toast.error("Please sign in to upgrade");
      navigate("/auth");
      onOpenChange(false);
      return;
    }

    if (onUpgrade) {
      onUpgrade();
      return;
    }

    navigate("/pricing");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center" role="img" aria-label="Crown icon">
            <Crown className="w-8 h-8 text-primary-foreground" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {isPro ? "Upgrade Your Plan?" : "Need More Credits?"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isPro 
              ? "Consider upgrading for even more features and benefits!" 
              : `You have ${creditsLeft} of ${creditsMax} credits remaining. Upgrade to Pro for unlimited access!`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500" aria-hidden="true" />
              Pro Benefits:
            </h4>
            <ul className="space-y-1 text-sm text-muted-foreground" role="list">
              <li className="flex items-start gap-2" role="listitem">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" 
                  aria-hidden="true"
                />
                <span>1,000 credits per month</span>
              </li>
              <li className="flex items-start gap-2" role="listitem">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" 
                  aria-hidden="true"
                />
                <span>Process scanned PDFs with OCR</span>
              </li>
              <li className="flex items-start gap-2" role="listitem">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" 
                  aria-hidden="true"
                />
                <span>Priority processing queue</span>
              </li>
              <li className="flex items-start gap-2" role="listitem">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" 
                  aria-hidden="true"
                />
                <span>Larger file uploads (50 MB)</span>
              </li>
              <li className="flex items-start gap-2" role="listitem">
                <div 
                  className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" 
                  aria-hidden="true"
                />
                <span>All future features included</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">₦3,000/month</p>
            <p className="text-sm text-muted-foreground">~$6.50 USD</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            aria-label="Close upgrade prompt"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isProcessing}
            className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black"
            aria-label={isProcessing ? "Processing upgrade" : "Upgrade to Pro plan"}
          >
            {isProcessing ? (
              <>
                <div 
                  className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" 
                  role="status"
                  aria-label="Processing"
                />
                Processing...
              </>
            ) : (
              <>
                <Crown className="mr-2 h-4 w-4" aria-hidden="true" />
                Upgrade Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};