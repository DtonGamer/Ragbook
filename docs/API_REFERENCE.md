# 🔌 API Reference

Complete API documentation for RAG Book Edge Functions and database operations.

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Edge Functions](#edge-functions)
  - [submit-document](#submit-document)
  - [rag-chat-credits](#rag-chat-credits)
  - [monnify-webhook](#monnify-webhook)
- [Database Functions](#database-functions)
- [Error Codes](#error-codes)

---

## 🔐 Authentication

All API requests (except webhooks) require authentication using Supabase JWT tokens.

### Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Getting a Token

Tokens are automatically managed by the Supabase client in the frontend:

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## ⚡ Edge Functions

Base URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`

---

### submit-document

Queues a document for asynchronous processing by the worker.

#### Endpoint

```http
POST /submit-document
```

#### Request Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_id` | UUID | Yes | ID of the document to process |

#### Response (Success)

**Status**: `200 OK`

```json
{
  "success": true,
  "message": "Document queued for processing",
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "needs_ocr": false
}
```

#### Response (Error)

**Status**: `400 Bad Request` / `401 Unauthorized` / `404 Not Found`

```json
{
  "error": "Document not found or access denied"
}
```

#### Example Usage

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/submit-document`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ document_id: documentId })
  }
);

const data = await response.json();
```

#### Error Codes

| Code | Description |
|------|-------------|
| `400` | Missing or invalid document_id |
| `401` | Unauthorized (invalid or missing token) |
| `404` | Document not found or user doesn't own it |
| `500` | Internal server error |

---

### rag-chat-credits

Handles chat requests with credit checking, vector search, and AI response generation.

#### Endpoint

```http
POST /rag-chat-credits
```

#### Request Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Request Body

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is machine learning?"
    }
  ],
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Array | Yes | Array of message objects |
| `messages[].role` | String | Yes | Message role: `user`, `assistant`, or `system` |
| `messages[].content` | String | Yes | Message content |
| `conversationId` | UUID | No | Conversation ID (creates new if not provided) |

#### Response (Success)

**Status**: `200 OK`

**Content-Type**: `text/event-stream` (Server-Sent Events)

The response is a stream of events:

```
data: {"type":"credits","remaining":49,"max":50,"plan":"free"}

data: {"type":"content","delta":"Machine"}

data: {"type":"content","delta":" learning"}

data: {"type":"content","delta":" is a subset"}

data: {"type":"sources","sources":[{"content":"ML is...","similarity":0.85,"document_id":"..."}]}

data: [DONE]
```

#### Event Types

| Type | Description | Fields |
|------|-------------|--------|
| `credits` | User's credit information | `remaining`, `max`, `plan` |
| `content` | Streaming response chunk | `delta` (text chunk) |
| `sources` | Retrieved knowledge base sources | `sources` (array) |
| `[DONE]` | End of stream | - |

#### Source Object

```json
{
  "content": "Text content from knowledge base",
  "similarity": 0.85,
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "chunk_index": 5
}
```

#### Response (Error)

**Status**: `400 Bad Request` / `401 Unauthorized` / `403 Forbidden`

```json
{
  "error": "Insufficient credits",
  "credits_remaining": 0
}
```

#### Example Usage

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/rag-chat-credits`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello!' }],
      conversationId: conversationId
    })
  }
);

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      const event = JSON.parse(data);
      console.log(event);
    }
  }
}
```

#### Error Codes

| Code | Description |
|------|-------------|
| `400` | Invalid request body |
| `401` | Unauthorized |
| `403` | Insufficient credits |
| `500` | Internal server error |

---

### monnify-webhook

Handles payment webhooks from Monnify. This endpoint is called by Monnify, not by the frontend.

#### Endpoint

```http
POST /monnify-webhook
```

#### Request Headers

```http
Content-Type: application/json
x-monify-signature: <SIGNATURE>
```

#### Request Body

Monnify sends different payloads based on the event type.

**TRANSACTION.COMPLETED**:
```json
{
  "eventType": "TRANSACTION.COMPLETED",
  "data": {
    "transactionReference": "ref_123456",
    "amount": 300000,
    "customer": {
      "email": "user@example.com",
      "name": "Customer Name"
    },
    "contractCode": "MC_xxxxx"
  }
}
```

**SUBSCRIPTION.CREATED**:
```json
{
  "eventType": "SUBSCRIPTION.CREATED",
  "data": {
    "contractCode": "MC_xxxxx",
    "customer": {
      "email": "user@example.com",
      "name": "Customer Name"
    }
  }
}
```

#### Response (Success)

**Status**: `200 OK`

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

#### Response (Error)

**Status**: `400 Bad Request` / `401 Unauthorized`

```json
{
  "error": "Invalid signature"
}
```

#### Events Handled

| Event | Action |
|-------|--------|
| `SUCCESSFUL_TRANSACTION` | Update user to Pro plan, set credits to 1000 |
| `MANDATE_UPDATE` | Handle mandate status changes (subscription activation/cancellation) |

#### Security

The webhook verifies the `x-monify-signature` header to ensure requests are from Monnify.

---

## 🗄️ Database Functions

These are PostgreSQL functions that can be called from the frontend or Edge Functions.

### decrement_credits

Atomically decrements a user's credits.

#### SQL

```sql
SELECT decrement_credits('550e8400-e29b-41d4-a716-446655440000');
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | UUID | User's ID |

#### Returns

```json
{
  "success": true,
  "credits_remaining": 49
}
```

#### Example (from Edge Function)

```typescript
const { data, error } = await supabase
  .rpc('decrement_credits', { user_id: userId });
```

### match_documents

Performs vector similarity search on the knowledge base.

#### SQL

```sql
SELECT * FROM match_documents(
  query_embedding := '[0.1, 0.2, ...]',
  match_threshold := 0.7,
  match_count := 5
);
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query_embedding` | vector(384) | Query embedding vector |
| `match_threshold` | float | Minimum similarity (0-1) |
| `match_count` | int | Max results to return |

#### Returns

Array of matching documents:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Text content",
    "similarity": 0.85,
    "document_id": "...",
    "chunk_index": 5
  }
]
```

#### Example (from Edge Function)

```typescript
const { data, error } = await supabase
  .rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5
  });
```

---

## ❌ Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions or credits |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server error |

### Custom Error Codes

| Code | Description |
|------|-------------|
| `INSUFFICIENT_CREDITS` | User has no credits remaining |
| `DOCUMENT_NOT_FOUND` | Document doesn't exist or user doesn't own it |
| `INVALID_SIGNATURE` | Webhook signature verification failed |
| `PROCESSING_FAILED` | Document processing failed in worker |

---

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `submit-document` | 10 requests | 1 minute |
| `rag-chat-credits` | 20 requests | 1 minute |
| `paystack-webhook` | Unlimited | - |

Rate limits are enforced by Supabase and return a `429 Too Many Requests` status when exceeded.

---

## 🔄 Webhooks

### Configuring Webhooks

1. Go to Paystack dashboard
2. Navigate to **Settings → Webhooks**
3. Add endpoint: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`
4. Select events: `charge.success`, `subscription.create`, `subscription.disable`

### Testing Webhooks

Use Paystack's webhook testing tool in the dashboard to send test events.

---

## 📝 Examples

### Complete Chat Flow

```typescript
// 1. Get session
const { data: { session } } = await supabase.auth.getSession();

// 2. Send chat request
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/rag-chat-credits`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Explain quantum computing' }
      ],
      conversationId: conversationId
    })
  }
);

// 3. Process stream
const reader = response.body?.getReader();
const decoder = new TextDecoder();
let fullResponse = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      const event = JSON.parse(data);
      
      if (event.type === 'content') {
        fullResponse += event.delta;
        // Update UI with streaming text
      } else if (event.type === 'sources') {
        // Display sources
        console.log('Sources:', event.sources);
      } else if (event.type === 'credits') {
        // Update credits display
        console.log('Credits:', event.remaining);
      }
    }
  }
}
```

### Complete Document Upload Flow

```typescript
// 1. Upload file to Supabase Storage
const file = event.target.files[0];
const filePath = `${userId}/${Date.now()}_${file.name}`;

const { error: uploadError } = await supabase.storage
  .from('documents')
  .upload(filePath, file);

// 2. Create document record
const { data: document, error: dbError } = await supabase
  .from('documents')
  .insert({
    user_id: userId,
    filename: file.name,
    storage_path: filePath,
    mime_type: file.type,
    file_size: file.size,
    status: 'pending'
  })
  .select()
  .single();

// 3. Submit for processing
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/submit-document`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ document_id: document.id })
  }
);

// 4. Listen for real-time updates
supabase
  .channel('document-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'documents',
      filter: `id=eq.${document.id}`
    },
    (payload) => {
      console.log('Status:', payload.new.status);
      console.log('Message:', payload.new.status_message);
    }
  )
  .subscribe();
```

---

## 🔗 Related Documentation

- [Main README](./README.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)

---

**Need help? Check the [troubleshooting section](./README.md#troubleshooting) in the main README.**
