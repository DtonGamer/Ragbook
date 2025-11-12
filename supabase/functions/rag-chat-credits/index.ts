import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// ============================================================================
// CONFIGURATION
// ============================================================================
const EMBEDDING_DIMENSIONS = 384;
const MAX_MESSAGE_LENGTH = 10000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// VALIDATION
// ============================================================================
function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required' };
  }
  
  const sanitized = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }
  
  return { isValid: true, sanitized };
}

function validateUuid(uuid) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
}

// ============================================================================
// FAST-PATH PATTERN MATCHING (Instant Routing)
// ============================================================================
function checkFastPathPatterns(message) {
  const lower = message.toLowerCase().trim();

  // Greetings → instant general chat
  const greetings = [
    'hello', 'hi', 'hey', 'greetings', 'good morning', 
    'good afternoon', 'good evening', 'what\'s up', 'whats up', 'sup'
  ];
  if (greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','))) {
    return { decision: 'general', reason: 'greeting' };
  }

  // Document list requests (more specific patterns first)
  const listPatterns = [
    'list my files', 'show my documents', 'what files do i have',
    'show my files', 'list my documents', 'what documents do i have'
  ];
  if (listPatterns.some(p => lower.includes(p))) {
    return { decision: 'list_documents', reason: 'list_request' };
  }

  // Explicit document references → instant document search
  const docPatterns = [
    'my document', 'my pdf', 'my file', 'my notes', 'my textbook',
    'in my document', 'from my document', 'according to my',
    'in the document', 'the pdf says', 'my notes say'
  ];
  if (docPatterns.some(p => lower.includes(p))) {
    return { decision: 'document', reason: 'explicit_document_reference' };
  }

  // Short general questions (likely chat)
  if (message.length < 30 && !lower.includes('document') && 
      !lower.includes('file') && !lower.includes('pdf')) {
    return { decision: 'general', reason: 'short_question' };
  }

  return null; // Ambiguous - needs AI analysis
}

// ============================================================================
// HUGGINGFACE EMBEDDING
// ============================================================================
async function generateQueryEmbedding(queryText) {
  const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  const response = await fetch(
    'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: queryText,
        options: { wait_for_model: true }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const embedding = await response.json();
  const result = Array.isArray(embedding[0]) ? embedding[0] : embedding;

  if (result.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${result.length}`);
  }

  return result;
}

// ============================================================================
// AI INTENT ANALYSIS (Only for ambiguous queries)
// ============================================================================
async function analyzeQueryIntent(message, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    // Simple fallback
    const lower = message.toLowerCase();
    return lower.includes('document') || lower.includes('pdf') || 
           lower.includes('file') || lower.includes('my notes');
  }

  const prompt = `Does this query need to search user's uploaded documents?

HISTORY: ${conversationHistory.slice(-2000) || 'None'}
USER: "${message}"

Return JSON only:
{"shouldSearch": boolean, "reason": string}

Search docs if: mentions "my document/file/PDF", asks about uploaded content
Use general knowledge if: greeting, general question, casual chat`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const intent = JSON.parse(cleanText);

    return intent.shouldSearch === true;
  } catch (error) {
    console.error('Intent analysis failed:', error);
    return false; // Default to general chat on error
  }
}

// ============================================================================
// CREDIT MANAGEMENT
// ============================================================================
async function checkAndDecrementCredits(supabase, userId) {
  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .select('plan, credits_remaining')
    .eq('user_id', userId)
    .single();

  if (error || !subscription) {
    // Create new user with free credits
    await supabase.from('user_subscriptions').insert({
      user_id: userId,
      plan: 'free',
      credits_remaining: 50,
      credits_max: 50
    });
    return { success: true, remaining: 49, plan: 'free' };
  }

  const { plan, credits_remaining } = subscription;

  if (credits_remaining <= 0) {
    return {
      success: false,
      remaining: 0,
      plan,
      message: plan === 'pro' 
        ? 'Pro credits exhausted. Contact support.' 
        : 'Out of credits. Upgrade to Pro for 1000 credits.'
    };
  }

  // Decrement credits
  await supabase
    .from('user_subscriptions')
    .update({ 
      credits_remaining: credits_remaining - 1,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  return { success: true, remaining: credits_remaining - 1, plan };
}

// ============================================================================
// GENERAL CHAT
// ============================================================================
async function generateGeneralChatResponse(message, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `You are RAG Book, a friendly AI study companion.

Recent conversation:
${conversationHistory.slice(-5000) || 'None'}

User: "${message}"

Respond naturally and helpfully.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1024
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 
    "Hey! I'm here to help. What's on your mind?";
}

// ============================================================================
// RAG RESPONSE
// ============================================================================
async function generateRagResponse(message, chunks, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const context = chunks.map((chunk, idx) => 
    `[Source ${idx + 1}: ${chunk.document_title}]\n${chunk.content}`
  ).join('\n\n---\n\n');

  const prompt = `You are RAG Book, an AI study companion.

CONVERSATION:
${conversationHistory.slice(-5000) || 'Start of conversation'}

RETRIEVED INFO:
${context}

USER QUESTION:
"${message}"

Answer based on the documents. Cite sources naturally. Be conversational.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 
    "I couldn't generate a response. Please try again.";
}

// ============================================================================
// DOCUMENT SEARCH (with pre-check optimization)
// ============================================================================
async function searchDocuments(supabase, userId, message) {
  // Fast path: check if user has any documents first
  const { count, error: countError } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (countError || !count || count === 0) {
    console.log('No completed documents found for user');
    return { chunks: [], error: 'no_documents' };
  }

  console.log('Searching documents for:', message);

  // Generate embedding
  const queryEmbedding = await generateQueryEmbedding(message);

  // Try hybrid search first
  let chunks;
  try {
    const keywordQuery = message
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .join(' & ');

    const { data, error } = await supabase.rpc('hybrid_search_documents', {
      query_text: keywordQuery,
      query_embedding: queryEmbedding,
      p_user_id: userId,
      match_threshold: 0.65,
      match_count: 5
    });

    if (error) throw error;
    chunks = data || [];
  } catch (error) {
    console.log('Hybrid search failed, using vector search:', error.message);

    // Fallback to vector search
    const { data, error: vecError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.65,
      match_count: 5,
      p_user_id: userId
    });

    if (vecError) throw vecError;
    chunks = data || [];
  }

  return { chunks, error: null };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
async function handleRequest(req) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();

    // Validate input
    const messageValidation = validateMessage(body.message);
    if (!messageValidation.isValid) {
      return new Response(
        JSON.stringify({ error: messageValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUuid(body.conversationId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid conversation ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedMessage = messageValidation.sanitized;
    const conversationId = body.conversationId;

    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify conversation ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // FAST-PATH CHECK: List Documents (No Credit Charge)
    // ============================================================================
    const fastPathResult = checkFastPathPatterns(sanitizedMessage);

    if (fastPathResult?.decision === 'list_documents') {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, original_name, created_at, status, chunk_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let responseContent;
      if (!documents || documents.length === 0) {
        responseContent = "You haven't uploaded any documents yet. You can upload documents from the Documents page to get started.";
      } else {
        const formatStatus = (doc) => {
          if (doc.status === 'completed') return `✅ Ready (${doc.chunk_count || 0} chunks)`;
          if (doc.status === 'processing') return `⏳ Processing`;
          if (doc.status === 'failed') return `❌ Failed`;
          return `📤 ${doc.status}`;
        };

        const docList = documents.map(doc => 
          `• **${doc.original_name}** - ${formatStatus(doc)}\n  Uploaded: ${new Date(doc.created_at).toLocaleDateString()}`
        ).join('\n\n');

        const completedCount = documents.filter(d => d.status === 'completed').length;
        responseContent = `Here are your uploaded documents:\n\n${docList}\n\n---\n\n**Summary:** ${completedCount} of ${documents.length} documents ready to search.`;
      }

      // Save messages
      await Promise.all([
        supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: sanitizedMessage
        }),
        supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: responseContent
        }),
        supabase.from('conversations').update({
          updated_at: new Date().toISOString()
        }).eq('id', conversationId)
      ]);

      // Get credits without decrementing
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('credits_remaining, plan')
        .eq('user_id', user.id)
        .single();

      return new Response(
        JSON.stringify({
          message: responseContent,
          sources: [],
          conversationId: conversationId,
          credits: sub?.credits_remaining || 0,
          plan: sub?.plan || 'free'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // PARALLEL OPERATIONS: Fetch history + Save user message
    // ============================================================================
    const [historyResult] = await Promise.all([
      supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100), // Increased history limit
      supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: sanitizedMessage
      })
    ]);

    const conversationHistory = (historyResult.data || [])
      .reverse()
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // ============================================================================
    // DETERMINE ROUTING (Fast-path or AI analysis)
    // ============================================================================
    let shouldSearchDocs = false;

    if (fastPathResult) {
      shouldSearchDocs = fastPathResult.decision === 'document';
      console.log(`⚡ Fast-path: ${fastPathResult.decision} (${fastPathResult.reason})`);
    } else {
      // Only call AI for ambiguous queries
      shouldSearchDocs = await analyzeQueryIntent(sanitizedMessage, conversationHistory);
      console.log(`🤖 AI analysis: ${shouldSearchDocs ? 'document' : 'general'}`);
    }

    // ============================================================================
    // CHECK CREDITS (After routing decision)
    // ============================================================================
    const creditResult = await checkAndDecrementCredits(supabase, user.id);
    if (!creditResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          message: creditResult.message,
          credits: 0,
          plan: creditResult.plan
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================================
    // GENERATE RESPONSE
    // ============================================================================
    let responseContent = '';
    let sources = [];

    if (shouldSearchDocs) {
      console.log('🔍 Searching documents');
      const { chunks, error: searchError } = await searchDocuments(supabase, user.id, sanitizedMessage);

      if (searchError === 'no_documents') {
        responseContent = "You haven't uploaded any documents yet. You can upload documents from the Documents page to get started.";
      } else if (!chunks || chunks.length === 0) {
        responseContent = "I couldn't find relevant information in your documents. Try rephrasing or check if you've uploaded the right files.";
      } else {
        responseContent = await generateRagResponse(sanitizedMessage, chunks, conversationHistory);
        sources = chunks.map(chunk => ({
          document_id: chunk.document_id,
          document_title: chunk.document_title,
          similarity: chunk.similarity,
          content: chunk.content.substring(0, 200) + '...'
        }));
      }
    } else {
      console.log('💬 Using general chat');
      responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
    }

    // ============================================================================
    // SAVE RESPONSE & UPDATE CONVERSATION (Parallel)
    // ============================================================================
    await Promise.all([
      supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseContent,
        metadata: sources.length > 0 ? { sources } : null
      }),
      supabase.from('conversations').update({
        updated_at: new Date().toISOString()
      }).eq('id', conversationId)
    ]);

    return new Response(
      JSON.stringify({
        message: responseContent,
        sources: sources,
        conversationId: conversationId,
        credits: creditResult.remaining,
        plan: creditResult.plan
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// ============================================================================
// SERVE
// ============================================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  return handleRequest(req);
});