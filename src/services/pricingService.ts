import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

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

export interface RawPricingPlan {
  id: string;
  name: string;
  price_kobo: number;
  currency: string;
  credits: number;
  credits_frequency: string | null;
  max_file_size: string;
  processing_queue: string;
  features: string[];
  icon: string;
  recommended: boolean;
}

/**
 * Fetches pricing plans from Supabase database
 * @returns PricingConfig object with plans from the database
 */
export const fetchPricingPlans = async (): Promise<PricingConfig> => {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .order('price_kobo', { ascending: true });

    if (error) {
      console.error('Error fetching pricing plans:', error);
      throw new Error(`Failed to fetch pricing plans: ${error.message}`);
    }

    // Map database format to frontend format
    const plans: PricingPlan[] = data.map((plan: RawPricingPlan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price_kobo,
      currency: plan.currency,
      credits: plan.credits,
      creditsFrequency: plan.credits_frequency || undefined,
      maxFileSize: plan.max_file_size,
      processingQueue: plan.processing_queue,
      features: plan.features,
      icon: plan.icon,
      recommended: plan.recommended
    }));

    // Define success messages (these might also be stored in a table, but keeping as constant for now)
    const successMessages = [
      '1,000 credits added to your account',
      'OCR processing now enabled',
      'Priority queue activated',
    ];

    return {
      plans,
      successMessages
    };
  } catch (error) {
    console.error('Unexpected error in fetchPricingPlans:', error);
    throw error;
  }
};

/**
 * Gets a single pricing plan by ID
 * @param planId The ID of the plan to retrieve
 * @returns Single pricing plan
 */
export const fetchPricingPlanById = async (planId: string): Promise<PricingPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Record not found
        return null;
      }
      console.error('Error fetching pricing plan:', error);
      throw new Error(`Failed to fetch pricing plan: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Map database format to frontend format
    const plan: PricingPlan = {
      id: data.id,
      name: data.name,
      price: data.price_kobo,
      currency: data.currency,
      credits: data.credits,
      creditsFrequency: data.credits_frequency || undefined,
      maxFileSize: data.max_file_size,
      processingQueue: data.processing_queue,
      features: data.features,
      icon: data.icon,
      recommended: data.recommended
    };

    return plan;
  } catch (error) {
    console.error('Unexpected error in fetchPricingPlanById:', error);
    throw error;
  }
};