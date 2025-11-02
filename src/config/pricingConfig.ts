import { fetchPricingPlans } from "@/services/pricingService";

export interface PricingPlan {
  id: string;
  name: string;
  price: number; // in kobo (smallest currency unit)
  currency: string;
  credits: number;
  creditsFrequency?: string; // e.g., 'month', 'one-time'
  maxFileSize: string; // e.g., '10 MB', '50 MB'
  processingQueue: string; // e.g., 'standard', 'priority'
  features: string[];
  icon: string; // e.g., 'zap', 'crown'
  recommended?: boolean;
}

export interface PricingConfig {
  plans: PricingPlan[];
  successMessages: string[];
}

// Keep hardcoded fallback values as backup in case Supabase is unavailable
const fallbackPricingConfig: PricingConfig = {
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: 0, // ₦0 in kobo
      currency: 'NGN',
      credits: 50,
      creditsFrequency: 'one-time',
      maxFileSize: '10 MB',
      processingQueue: 'standard',
      features: [
        'Digital PDF processing',
        'Standard processing queue',
        'Community support',
      ],
      icon: 'zap',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 300000, // ₦3,000 in kobo
      currency: 'NGN',
      credits: 1000,
      creditsFrequency: 'month',
      maxFileSize: '50 MB',
      processingQueue: 'priority',
      features: [
        'Digital + Scanned PDF (OCR)',
        'Priority processing queue',
        'Advanced OCR (multi-language)',
        'All future features included',
        'Priority email support (24h)',
      ],
      icon: 'crown',
      recommended: true,
    },
  ],
  successMessages: [
    '1,000 credits added to your account',
    'OCR processing now enabled',
    'Priority queue activated',
  ],
};

/**
 * Function to get pricing configuration from Supabase with fallback to hardcoded values
 */
export const getPricingConfig = async (): Promise<PricingConfig> => {
  try {
    const pricingConfig = await fetchPricingPlans();
    return pricingConfig;
  } catch (error) {
    console.error('Failed to fetch pricing plans from Supabase:', error);
    console.warn('Using fallback pricing configuration');
    return fallbackPricingConfig;
  }
};

// Export the fallback config as default for non-async contexts
export const pricingConfig = fallbackPricingConfig;