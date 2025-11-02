# RAG Book AI Agent Instructions

## Project Overview
RAG Book is a production-grade RAG (Retrieval Augmented Generation) system featuring:
- Document processing with OCR support and vector search
- Credit-based payment system with Paystack
- Real-time updates via Supabase
- Row-Level Security (RLS) policies
- 384-dimensional HuggingFace embeddings

## Key Architecture Components

### Frontend (`src/`)
- React 18 + TypeScript + Vite
- TanStack Query for server state
- shadcn/ui components in `src/components/ui/`
- Real-time subscriptions for document status
- Example: See `src/hooks/useDocumentStatus.ts` for real-time patterns

### Backend (`supabase/`)
- Edge Functions (Deno) for payment webhook and document submission
- RLS policies control data access
- Vector-enabled knowledge_base table
- Critical: Always set explicit `search_path` in functions

### Worker System (`worker/`)
- Redis-based queue for PDF processing
- OCR and embedding generation (384-dim vectors)
- Memory-optimized for 512MB environments
- See: `worker/worker.py` for processing pipeline

## Development Workflows

### Local Setup
```bash
npm install
cp .env.example .env  # Set Supabase credentials
cd worker && docker-compose up --build
npm run dev  # New terminal
```

### Key Commands
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run test` - Run test suite
- Docker commands for worker in `worker/docker-compose.yml`

## Project-Specific Patterns

### Database Access
- Never bypass RLS - use service role only in worker/edge functions
- Tables require user_id for RLS policies
- Example policy structure in `supabase/migrations/20250202000002_create_rls_and_triggers.sql`

### State Management
- Use custom hooks for shared logic (`src/hooks/`)
- TanStack Query for server state
- Supabase Realtime for document status
- Clean up subscriptions in useEffect

### Error Handling
- Log errors to security_events table
- Handle OCR failures gracefully
- Validate credit balance before operations
- Show user-friendly error messages

### Vector Search
- Optimized for 384-dim embeddings (not 768)
- Batch process embeddings in worker
- Use proper indexing for vector queries

## Integration Points
- Paystack webhook: `supabase/functions/paystack-webhook/`
- Document submission: `supabase/functions/submit-document/`
- OCR processing: `worker/ocr_processor.py`
- Credit system: `supabase/functions/rag-chat-credits/`

## Common Pitfalls
- Avoid circular dependencies in RLS policies
- Don't expose API keys in frontend code
- Prevent memory leaks from Realtime subscriptions
- Handle background tasks memory-efficiently

## File References
- RLS Policies: `supabase/migrations/*_create_rls_and_triggers.sql`
- Worker Architecture: `docs/WORKER_ARCHITECTURE_MAP.md`
- Database Schema: `docs/API_REFERENCE.md`
- Development Guide: `docs/DEVELOPER_GUIDE.md`
