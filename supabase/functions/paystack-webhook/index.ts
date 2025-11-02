import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    // Verify Paystack signature
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    if (!signature) {
      console.error('Missing Paystack signature');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create hash
    const hash = createHmac('sha512', paystackSecretKey)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Paystack signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse webhook event
    const event = JSON.parse(body);
    console.log('✓ Paystack webhook event received:', event.event);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.event) {
      case 'charge.success': {
        // Payment successful
        const { customer, amount, reference } = event.data;
        const email = customer.email;

        console.log(`💰 Payment successful: ${email}, Amount: ₦${amount / 100}`);

        // Find user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

        if (userError) {
          console.error('Error fetching users:', userError);
          break;
        }

        const user = userData.users.find((u: any) => u.email === email);

        if (!user) {
          console.error(`❌ User not found: ${email}`);
          break;
        }

        const userId = user.id;

        // Update subscription to Pro
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan: 'pro',
            credits_remaining: 1000,
            credits_max: 1000,
            last_refresh_date: new Date().toISOString(),
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
            paystack_customer_code: customer.customer_code,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Failed to update subscription:', updateError);
        } else {
          console.log(`✅ Upgraded user ${email} to Pro (reference: ${reference})`);
        }
        break;
      }

      case 'subscription.create': {
        // Subscription created
        const { customer, subscription_code } = event.data;
        const email = customer.email;

        console.log(`🔄 Subscription created: ${email}`);

        // Find user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

        if (userError) {
          console.error('Error fetching users:', userError);
          break;
        }

        const user = userData.users.find((u: any) => u.email === email);

        if (!user) {
          console.error(`❌ User not found: ${email}`);
          break;
        }

        const userId = user.id;

        // Update subscription
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan: 'pro',
            credits_remaining: 1000,
            credits_max: 1000,
            last_refresh_date: new Date().toISOString(),
            subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            paystack_subscription_id: subscription_code,
            paystack_customer_code: customer.customer_code,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Failed to update subscription:', updateError);
        } else {
          console.log(`✅ Created subscription for ${email} (code: ${subscription_code})`);
        }
        break;
      }

      case 'subscription.disable': {
        // Subscription cancelled
        const { customer } = event.data;
        const email = customer.email;

        console.log(`⚠️  Subscription cancelled: ${email}`);

        // Find user by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();

        if (userError) {
          console.error('Error fetching users:', userError);
          break;
        }

        const user = userData.users.find((u: any) => u.email === email);

        if (!user) {
          console.error(`❌ User not found: ${email}`);
          break;
        }

        const userId = user.id;

        // Downgrade to free
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan: 'free',
            credits_remaining: 0, // Exhausted
            credits_max: 50,
            subscription_end_date: null,
            paystack_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Failed to downgrade subscription:', updateError);
        } else {
          console.log(`✅ Downgraded user ${email} to Free`);
        }
        break;
      }

      default:
        console.log(`ℹ️  Unhandled event type: ${event.event}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in paystack-webhook:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});