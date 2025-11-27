import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-monify-signature',
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
    // Get Monnify secret key
    const monnifySecretKey = Deno.env.get('MONNIFY_SECRET_KEY');

    if (!monnifySecretKey) {
      console.error('MONNIFY_SECRET_KEY not configured');
      throw new Error('MONNIFY_SECRET_KEY not configured');
    }

    // Verify Monnify signature
    const signature = req.headers.get('x-monify-signature');
    const body = await req.text();

    if (!signature) {
      console.error('Missing Monnify signature');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create hash for signature verification
    // Monnify uses SHA512 hash of the request body with the secret key
    const hash = createHmac('sha512', monnifySecretKey)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Monnify signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse webhook event
    const event = JSON.parse(body);
    console.log('✓ Monnify webhook event received:', event.eventType);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.eventType) {
      case 'SUCCESSFUL_TRANSACTION': {
        // Payment successful
        const { amountPaid, customer, transactionReference, product } = event.eventData;
        const email = customer.email;

        console.log(`💰 Payment successful: ${email}, Amount: ₦${amountPaid}`);

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
            monnify_contract_code: product?.reference || null,
            monnify_customer_email: email,
            monnify_customer_name: customer.name,
            monnify_transaction_reference: transactionReference,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Failed to update subscription:', updateError);
        } else {
          console.log(`✅ Upgraded user ${email} to Pro (reference: ${transactionReference})`);
        }
        break;
      }

      case 'MANDATE_UPDATE': {
        // Handle mandate status changes (subscriptions)
        const { customerEmailAddress, mandateStatus, mandateCode, contractCode } = event.eventData;
        const email = customerEmailAddress;

        console.log(`🔄 Mandate status changed: ${mandateStatus} for ${email}`);

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

        if (mandateStatus === 'CANCELLED') {
          // Mandate cancelled - downgrade user to free
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
              plan: 'free',
              credits_remaining: 0, // Exhausted
              credits_max: 50,
              subscription_end_date: null,
              monnify_contract_code: contractCode || null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (updateError) {
            console.error('❌ Failed to downgrade subscription:', updateError);
          } else {
            console.log(`✅ Downgraded user ${email} to Free due to mandate cancellation`);
          }
        } else if (mandateStatus === 'ACTIVE') {
          // Mandate active - update to Pro plan
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
              plan: 'pro',
              credits_remaining: 1000,
              credits_max: 1000,
              last_refresh_date: new Date().toISOString(),
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              monnify_contract_code: contractCode,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

          if (updateError) {
            console.error('❌ Failed to update subscription:', updateError);
          } else {
            console.log(`✅ Updated subscription for ${email} due to mandate activation`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️  Unhandled event type: ${event.eventType}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in monnify-webhook:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});