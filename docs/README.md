# RAG Book - Enhanced AI Study Assistant

This project is a production-grade, scalable Retrieval-Augmented Generation (RAG) system designed for students. It features an asynchronous pipeline for processing large documents (including scanned PDFs with OCR), a credit-based payment system, and real-time status updates, all powered by a robust backend using Supabase, Redis, and a Python worker.

## 🚀 Core Features

- **Asynchronous Document Processing**: A Python worker handles heavy tasks like OCR and embedding generation in the background, preventing frontend timeouts.
- **OCR for Scanned PDFs**: Uses `OCRmyPDF` to extract text from scanned documents, making them searchable.
- **High-Quality Embeddings**: Leverages HuggingFace's `bge-small-en-v1.5` model for efficient and high-quality 384-dimensional embeddings with no rate limits.
- **Real-Time Status Updates**: Users can track their document's progress from `queued` to `completed` via Supabase Realtime.
- **Credit-Based Monetization**: Integrates with Monnify for a freemium model, giving users a starting credit balance and the option to upgrade for more.
- **Storage & Performance Optimized**: 384-dimensional vectors cut storage costs by 50% compared to 768-dim models, with optimized vector search.

## 📚 Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, pgvector, Storage, Auth, Realtime)
- **Worker**: Python, Docker, `sentence-transformers`, `OCRmyPDF`
- **Queue**: Upstash Redis
- **AI Models**: HuggingFace (Embeddings), Google Gemini (Chat)
- **Payments**: Monnify

## 🏗️ System Architecture

The system is decoupled into a frontend, serverless functions, a message queue, and a background worker to handle long-running tasks efficiently.

```mermaid
graph TD
    A[Frontend: React] -- Upload & Process Request --> B(Supabase Edge Functions);
    B -- 1. Push Job --> C{Redis Queue (Upstash)};
    B -- 2. Update Status: 'queued' --> D[Supabase DB];
    
    E[Python Worker] -- 3. Poll for Jobs --> C;
    E -- 4. Download PDF --> F[Supabase Storage];
    E -- 5. OCR & Chunking --> E;
    E -- 6. Generate Embeddings --> G[HuggingFace];
    E -- 7. Save to DB --> D;
    E -- 8. Update Status: 'processing' -> 'completed' --> D;

    A -- Real-time Subscription --> D;
    A -- Chat Request --> B;
    B -- Vector Search --> D;
    B -- Generate Response --> H[Gemini AI];
```

**Data Flow:**
1.  **Upload**: A user uploads a PDF via the React frontend.
2.  **Queue Job**: The `submit-document` Edge Function validates the request, pushes a job to a Redis queue, and immediately updates the document's status to `queued`.
3.  **Process**: The Python worker, running in a Docker container, polls Redis for new jobs.
4.  **Execute**: For each job, the worker downloads the PDF, runs OCR if needed, chunks the text, generates 384-dimensional embeddings, and stores the results in the `knowledge_base` table.
5.  **Update**: The worker continuously updates the document's status in the `documents` table, which the frontend listens to for real-time updates.
6.  **Chat**: The `rag-chat-credits` function handles chat requests, checks user credits, performs a vector search on the `knowledge_base`, and generates a response using Gemini.

## 🗄️ Database Schema

The schema is designed to support the asynchronous processing flow and credit system.

**`documents`**
- `id`: UUID, Primary Key
- `filename`: Original name of the file.
- `storage_path`: Path to the file in Supabase Storage.
- `status`: `document_status` ENUM (`pending`, `queued`, `processing`, `completed`, `failed`)
- `status_message`: Text description of the current status.
- `error_message`: Stores any errors from the worker.
- `chunk_count`: The total number of chunks generated.
- `needs_ocr`: Boolean flag for OCR.
- `processing_started_at`, `processing_completed_at`: Timestamps for performance tracking.

**`knowledge_base`**
- `id`: UUID, Primary Key
- `document_id`: Foreign Key to `documents`.
- `content`: The text chunk.
- `embedding`: `vector(384)` - The HuggingFace embedding.
- `token_count`: Number of tokens in the chunk.

**`user_subscriptions`**
- `id`: UUID, Primary Key
- `user_id`: Foreign Key to `auth.users`.
- `plan`: `subscription_plan` ENUM (`free`, `pro`).
- `credits_remaining`: Number of chat credits left.
- `credits_max`: Maximum credits for the plan.
- `paystack_customer_code`: For managing payments.

## 🚀 Getting Started (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js & npm
- Python 3.9+
- Supabase Account
- Upstash Redis Account

### 1. Set up Supabase
1.  Create a new project on Supabase.
2.  In the **SQL Editor**, run the migrations from the `supabase/migrations/` directory in chronological order to create the necessary tables and functions.
3.  Enable **Realtime** for the `documents` table in **Database > Replication**.

### 2. Configure Worker
1.  Navigate to the `worker/` directory.
2.  Create a `.env` file from `.env.example`.
3.  Fill in your `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `REDIS_URL` (from Upstash).

### 3. Run Locally
1.  **Start the worker**: `cd worker && docker-compose up --build`
2.  **Start the frontend**: `npm install && npm run dev`

For a complete deployment guide, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## 🗂️ Project Structure

```
current/
├── src/
│   ├── pages/              # Application pages
│   │   ├── Home.tsx        # Landing page
│   │   ├── Auth.tsx        # Login/signup
│   │   ├── Chat.tsx        # Main chat interface
│   │   ├── Documents.tsx   # Document management
│   │   ├── Admin.tsx       # Admin panel
│   │   ├── Pricing.tsx     # Subscription plans
│   │   └── ...
│   ├── components/         # Reusable components
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── DocumentUpload.tsx
│   │   ├── CreditsDisplay.tsx
│   │   └── ui/             # shadcn/ui components (52 files)
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts      # Authentication
│   │   ├── useSubscription.ts  # Credits & plans
│   │   └── useDocumentStatus.ts  # Real-time updates
│   └── integrations/
│       └── supabase/       # Supabase client & types
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── submit-document/
│   │   ├── rag-chat-credits/
│   │   └── paystack-webhook/
│   └── migrations/         # SQL migrations (13 files)
└── worker/                 # Python worker
    ├── worker.py           # Main worker loop
    ├── ocr_processor.py    # OCR processing
    ├── embeddings.py       # Embedding generation
    ├── chunker.py          # Text chunking
    ├── config.py           # Configuration
    ├── Dockerfile
    └── docker-compose.yml
```

## 📊 Complete Database Schema

### Core Tables

**`documents`** - Document metadata and processing status
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status document_status DEFAULT 'pending',
  status_message TEXT,
  error_message TEXT,
  needs_ocr BOOLEAN DEFAULT false,
  chunk_count INTEGER DEFAULT 0,
  total_chunks INTEGER,
  processed_chunks INTEGER,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`knowledge_base`** - Text chunks with embeddings
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384),  -- HuggingFace embeddings
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**`user_subscriptions`** - Credits and payment management
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan DEFAULT 'free',
  credits_remaining INTEGER DEFAULT 50,
  credits_max INTEGER DEFAULT 50,
  last_refresh_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  monnify_contract_code TEXT,
  monnify_customer_email TEXT,
  monnify_customer_name TEXT,
  monnify_transaction_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`conversations`** - Chat sessions
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`messages`** - Chat history
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,  -- For sources, citations, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`user_roles`** - Admin access control
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Enums

```sql
CREATE TYPE document_status AS ENUM (
  'pending', 'queued', 'processing', 'completed', 'failed', 'partial'
);

CREATE TYPE subscription_plan AS ENUM ('free', 'pro');

CREATE TYPE app_role AS ENUM ('user', 'admin');
```

## 🔧 Configuration

### Worker Environment Variables (`worker/.env`)

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://default:password@host:port

# Processing Configuration
BATCH_SIZE=32              # Embeddings per batch
CHUNK_SIZE=500             # Tokens per chunk
CHUNK_OVERLAP=50           # Token overlap between chunks

# OCR Configuration
OCR_LANGUAGES=eng          # Comma-separated (eng,fra,spa)
OCR_DPI=300                # DPI for OCR processing

# Logging
LOG_LEVEL=INFO
```

### Frontend Environment Variables (`.env`)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MONNIFY_PUBLIC_KEY=your_monnify_public_key
```

### Edge Function Secrets (Supabase)

```bash
REDIS_URL=redis://...
HUGGINGFACE_API_KEY=hf_...  # Optional, for API-based embeddings
GEMINI_API_KEY=your-key
MONNIFY_SECRET_KEY=your_monnify_secret_key
```

## 🔌 API Reference

### Edge Functions

#### 1. `submit-document`

Queues a document for processing.

**Endpoint**: `POST /functions/v1/submit-document`

**Request**:
```json
{
  "document_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Document queued for processing",
  "document_id": "uuid",
  "needs_ocr": false
}
```

#### 2. `rag-chat-credits`

Handles chat requests with credit checking and RAG.

**Endpoint**: `POST /functions/v1/rag-chat-credits`

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "What is machine learning?" }
  ],
  "conversationId": "uuid"
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"type":"credits","remaining":49,"max":50}
data: {"type":"content","delta":"Machine learning is..."}
data: {"type":"sources","sources":[{"content":"...","similarity":0.85}]}
data: [DONE]
```

#### 3. `monnify-webhook`

Handles payment webhooks from Monnify.

**Endpoint**: `POST /functions/v1/monnify-webhook`

**Events Handled**:
- `SUCCESSFUL_TRANSACTION` - Payment successful
- `MANDATE_UPDATE` - Handle mandate status changes (subscription activation/cancellation)

## 💰 Pricing Model

### Free Tier
- **Price**: ₦0
- **Credits**: 50 (one-time)
- **Features**:
  - Document processing
  - Chat with RAG
  - Max 10 MB per file

### Pro Tier
- **Price**: ₦3,000/month (~$6.50 USD)
- **Credits**: 1,000/month (refreshes)
- **Features**:
  - All Free features
  - OCR for scanned PDFs
  - Priority processing
  - Max 50 MB per file
  - Priority support

## 🐛 Troubleshooting

### Document Stuck in "queued"

**Symptoms**: Document status doesn't change from `queued`

**Causes**:
- Worker not running
- Redis connection issue
- Worker crashed

**Solutions**:
1. Check worker logs: `docker-compose logs -f worker`
2. Verify Redis connection: `redis-cli -u $REDIS_URL PING`
3. Check queue length: `redis-cli -u $REDIS_URL LLEN pdf-processing`
4. Restart worker: `docker-compose restart worker`

### OCR Processing Fails

**Symptoms**: Document status changes to `failed` with OCR-related error

**Causes**:
- Tesseract not installed
- Unsupported language
- Corrupted PDF

**Solutions**:
1. Check worker logs for specific error
2. Verify Tesseract installation: `docker exec worker which tesseract`
3. Try with a different PDF
4. Rebuild Docker image: `docker-compose build --no-cache`

### Credits Not Decrementing

**Symptoms**: User sends messages but credits stay the same

**Causes**:
- User has Pro plan (unlimited)
- Database function error
- RLS policy blocking update

**Solutions**:
1. Check user plan: `SELECT plan FROM user_subscriptions WHERE user_id = '...'`
2. Test function manually: `SELECT decrement_credits('user-id')`
3. Check Edge Function logs in Supabase dashboard

### Payment Not Reflecting

**Symptoms**: User paid but still on Free plan

**Causes**:
- Webhook not configured
- Webhook signature mismatch
- Database update failed

**Solutions**:
1. Check Paystack webhook logs
2. Verify webhook URL is correct
3. Check `paystack-webhook` function logs
4. Manually update: `UPDATE user_subscriptions SET plan='pro', credits_remaining=1000 WHERE user_id='...'`

## 🚀 Deployment

For detailed deployment instructions, see the separate deployment guide.

### Quick Deployment Checklist

- [ ] Supabase project created
- [ ] All migrations run successfully
- [ ] Realtime enabled for `documents` table
- [ ] Redis database created (Upstash)
- [ ] Worker deployed (Render/Railway)
- [ ] Edge Functions deployed
- [ ] Paystack webhook configured
- [ ] Frontend deployed (Vercel/Netlify)
- [ ] Test complete user flow

## 📈 Performance Metrics

### Processing Speed

| Document Size | Processing Time | Notes |
|--------------|-----------------|-------|
| 10 pages | ~7 seconds | Digital PDF |
| 50 pages | ~20 seconds | Digital PDF |
| 300 pages | ~80 seconds | Digital PDF |
| 10 pages (scanned) | ~2-4 minutes | With OCR |

### Storage Efficiency

- **384-dim vectors**: ~1.5 KB per chunk
- **50% savings** vs 768-dim vectors
- **Example**: 100-page document = ~200 chunks = ~300 KB

### Vector Search Performance

- **Average query time**: <100ms
- **Index type**: IVFFlat (lists=100)
- **Similarity metric**: Cosine similarity

## 🔒 Security Features

- **Row-Level Security (RLS)**: All tables protected
- **JWT Authentication**: Supabase Auth
- **API Key Rotation**: Supported via Supabase
- **Webhook Signature Verification**: Paystack webhooks
- **Input Sanitization**: All user inputs validated
- **Rate Limiting**: Built into Supabase

## 🤝 Contributing

This is a production application. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Supabase** - Backend infrastructure
- **HuggingFace** - Embedding models
- **Google Gemini** - Chat AI
- **Paystack** - Payment processing
- **shadcn/ui** - UI components

---

**Built with ❤️ for students**
