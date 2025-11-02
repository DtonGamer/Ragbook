import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { document_id } = await req.json();

    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, mime_type, user_id')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return new Response(JSON.stringify({ 
        error: 'Document not found or access denied' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Let worker intelligently detect if OCR is needed
    // Worker samples PDF pages to determine if text is extractable
    // This avoids unnecessary OCR processing for digital PDFs
    const needsOcr = false; // Worker auto-detects via detect_needs_ocr()

    // Prepare job data
    const jobData = {
      document_id: document.id,
      storage_path: document.storage_path,
      mime_type: document.mime_type,
      needs_ocr: needsOcr,
      user_id: user.id,
      queued_at: new Date().toISOString()
    };

    // Push job to Redis queue using Upstash REST API
    const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

    if (upstashUrl && upstashToken) {
      // Use Upstash REST API - correct format
      const response = await fetch(`${upstashUrl}/rpush/pdf-processing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${upstashToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([JSON.stringify(jobData)])
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Redis push failed:', errorText);
        throw new Error(`Failed to queue job in Redis: ${response.status}`);
      }

      const result = await response.json();
      console.log('Redis push result:', result);
    } else {
      // Fallback: Store job info in Supabase table for worker to poll
      await supabase.from('processing_queue').insert({
        document_id: document.id,
        user_id: user.id,
        job_data: jobData,
        status: 'queued'
      });
    }

    // Update document status to queued
    await supabase
      .from('documents')
      .update({
        status: 'queued',
        status_message: 'Queued for processing...',
        needs_ocr: needsOcr,
        updated_at: new Date().toISOString()
      })
      .eq('id', document_id);

    console.log(`✓ Document ${document_id} queued for processing`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Document queued for processing',
      document_id: document_id,
      needs_ocr: needsOcr
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in submit-document:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});