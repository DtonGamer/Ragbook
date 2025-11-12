# RAG Book - AI-Powered Knowledge Assistant

## Project Overview

This is a production-grade, scalable Retrieval-Augmented Generation (RAG) system designed for students. It features an asynchronous pipeline for processing large documents (including scanned PDFs with OCR), a credit-based payment system, and real-time status updates, all powered by a robust backend using Supabase, Redis, and a Python worker.

### Core Features

- **Asynchronous Document Processing**: A Python worker handles heavy tasks like OCR and embedding generation in the background, preventing frontend timeouts.
- **OCR for Scanned PDFs**: Uses `OCRmyPDF` to extract text from scanned documents, making them searchable.
- **High-Quality Embeddings**: Leverages HuggingFace's `bge-small-en-v1.5` model for efficient and high-quality 384-dimensional embeddings with no rate limits.
- **Real-Time Status Updates**: Users can track their document's progress from `queued` to `completed` via Supabase Realtime.
- **Credit-Based Monetization**: Integrates with Paystack for a freemium model, giving users a starting credit balance and the option to upgrade for more.
- **Storage & Performance Optimized**: 384-dimensional vectors cut storage costs by 50% compared to 768-dim models, with optimized vector search.

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, pgvector, Storage, Auth, Realtime)
- **Worker**: Python, Docker, `sentence-transformers`, `OCRmyPDF`
- **Queue**: Upstash Redis
- **AI Models**: HuggingFace (Embeddings), Google Gemini (Chat)
- **Payments**: Paystack
- **Deployment**: Vite for building, Netlify for hosting

### System Architecture

The system is decoupled into a frontend, serverless functions, a message queue, and a background worker to handle long-running tasks efficiently:

1. **Upload**: A user uploads a PDF via the React frontend.
2. **Queue Job**: The `submit-document` Edge Function validates the request, pushes a job to a Redis queue, and immediately updates the document's status to `queued`.
3. **Process**: The Python worker, running in a Docker container, polls Redis for new jobs.
4. **Execute**: For each job, the worker downloads the PDF, runs OCR if needed, chunks the text, generates 384-dimensional embeddings, and stores the results in the `knowledge_base` table.
5. **Update**: The worker continuously updates the document's status in the `documents` table, which the frontend listens to for real-time updates.
6. **Chat**: The `rag-chat-credits` function handles chat requests, checks user credits, performs a vector search on the `knowledge_base`, and generates a response using Gemini.

## Building and Running

### Prerequisites

- Docker & Docker Compose
- Node.js & npm (or Bun)
- Python 3.9+
- Supabase Account
- Upstash Redis Account

### Local Development Setup

1. **Clone the repository**
   ```
   git clone <repository-url>
   cd Rag-chatbot-main
   ```

2. **Install dependencies**
   ```
   npm install
   ```
   or
   ```
   bun install
   ```

3. **Set up environment variables**
   - Copy `env.template` to `.env.local` and fill in your Supabase and API keys
   - In the `worker/` directory, create a `.env` file from `.env.example` and fill in your credentials

4. **Set up Supabase**
   - Create a new project on Supabase
   - In the **SQL Editor**, run the migrations from the `supabase/migrations/` directory in chronological order
   - Enable **Realtime** for the `documents` table in **Database > Replication**

5. **Start the worker** (from the worker directory):
   ```
   cd worker && docker-compose up --build
   ```

6. **Start the frontend**:
   ```
   npm run dev
   ```
   or
   ```
   bun run dev
   ```

7. **Access the application**: Visit `http://localhost:8080` in your browser

### Production Build

To create a production build:

```
npm run build
```

To preview the production build:

```
npm run preview
```

## Development Conventions

### File Structure
```
Rag-chatbot-main/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and shared functions
│   ├── contexts/           # React context providers
│   ├── services/           # API services
│   └── integrations/       # Third-party integrations (e.g., Supabase)
├── supabase/              # Supabase configuration
│   ├── functions/         # Edge Functions (Deno)
│   └── migrations/        # Database schema migrations
├── worker/                # Python worker for document processing
├── public/                # Static assets
└── docs/                  # Documentation
```

### Code Style

- TypeScript is used throughout the frontend
- Components use shadcn/ui library for consistent UI
- Tailwind CSS for styling
- React hooks for state management
- React Router for navigation
- Supabase for authentication and database operations
- Zod for schema validation

### Key Dependencies

- `@supabase/supabase-js`: Supabase client library
- `@tanstack/react-query`: Server state management
- `react-router-dom`: Routing
- `lucide-react`: Icons
- `zod`: Schema validation
- `@hookform/resolvers`: Form validation
- `react-hook-form`: Form management
- `tailwind-merge`: Conditional class names
- `clsx`: Class name utility

## Database Schema

### Core Tables

**`documents`** - Document metadata and processing status
- `id`: UUID Primary Key
- `user_id`: Foreign Key to auth.users
- `filename`, `storage_path`: File information
- `status`: ENUM (`pending`, `queued`, `processing`, `completed`, `failed`)
- `status_message`, `error_message`: Processing feedback
- `needs_ocr`: Boolean flag
- `chunk_count`: Number of text chunks
- `created_at`, `updated_at`: Timestamps

**`knowledge_base`** - Text chunks with embeddings
- `id`: UUID Primary Key
- `document_id`: Foreign Key to `documents`
- `content`: Text chunk
- `embedding`: vector(384) for semantic search
- `chunk_index`, `token_count`: Chunk metadata

**`user_subscriptions`** - Credits and payment management
- `user_id`: Foreign Key to auth.users
- `plan`: ENUM (`free`, `pro`)
- `credits_remaining`, `credits_max`: Credit system

## API Reference

### Edge Functions

#### 1. `submit-document`
Queues a document for processing.
**Endpoint**: `POST /functions/v1/submit-document`

#### 2. `rag-chat-credits`
Handles chat requests with credit checking and RAG.
**Endpoint**: `POST /functions/v1/rag-chat-credits`
Returns Server-Sent Events (SSE) stream with response.

#### 3. `paystack-webhook`
Handles payment webhooks from Paystack.
**Endpoint**: `POST /functions/v1/paystack-webhook`

## Environment Variables

### Frontend Variables (`.env.local`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=RAG Book
VITE_VECTOR_DIMENSIONS=384
VITE_SIMILARITY_THRESHOLD=0.65
```

### Edge Function Secrets (Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `GOOGLE_API_KEY`: Google API key
- `GEMINI_API_KEY`: Gemini API key
- `REDIS_URL`: Redis connection string
- `PAYSTACK_SECRET_KEY`: Paystack secret key

### Worker Variables (`worker/.env`)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
REDIS_URL=redis://your-redis-url
BATCH_SIZE=4
CHUNK_SIZE=500
CHUNK_OVERLAP=50
OCR_LANGUAGES=eng
OCR_DPI=300
```

## Testing

While no explicit test files were found in the root, the project follows React best practices and can be tested using standard React testing tools like Jest, React Testing Library, and React Query's test utilities.

## Deployment

The project is configured for deployment on Netlify with the following settings:

- Build command: `npm run build` (or `bun run build`)
- Publish directory: `dist`
- Node version: 22.12.0

For a complete deployment, you'll also need to:
1. Deploy the Supabase backend
2. Set up the Python worker (deployed separately, e.g., on Railway/Render)
3. Configure all required environment variables
4. Set up Paystack webhook

## Troubleshooting

### Common Issues

1. **Document stuck in "queued"**: Ensure the Python worker is running and connected to Redis
2. **OCR processing fails**: Check that Tesseract is properly installed in the worker container
3. **Credits not decrementing**: Verify the user's subscription status and database function
4. **Build failures**: Ensure all dependencies are installed and environment variables are properly set

### Health Checks

The Python worker includes health check endpoints at `/health` and `/metrics` to monitor its status.