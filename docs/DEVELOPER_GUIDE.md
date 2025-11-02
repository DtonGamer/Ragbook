# 👨‍💻 Developer Guide

Quick reference for developers working on the RAG Book project.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone repository
git clone <your-repo-url>
cd current

# 2. Install frontend dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start worker
cd worker
cp .env.example .env
# Edit worker/.env with credentials
docker-compose up --build

# 5. Start frontend (in new terminal)
cd ..
npm run dev
```

---

## 📁 Project Structure

```
current/
├── src/                    # Frontend (React + TypeScript)
│   ├── pages/             # Route pages
│   ├── components/        # Reusable components
│   ├── hooks/             # Custom React hooks
│   └── integrations/      # Supabase client
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   └── migrations/        # Database migrations
└── worker/                # Python worker (Docker)
    ├── worker.py          # Main loop
    ├── ocr_processor.py   # OCR handling
    ├── embeddings.py      # Embedding generation
    └── chunker.py         # Text chunking
```

---

## 🔄 Data Flow

### Document Processing
```
User uploads PDF
  ↓
DocumentUpload.tsx → Supabase Storage
  ↓
submit-document Edge Function → Redis Queue
  ↓
Python Worker polls Redis
  ↓
Worker: Download → OCR → Chunk → Embed → Store
  ↓
Realtime update → Frontend
```

### Chat Flow
```
User sends message
  ↓
Chat.tsx → rag-chat-credits Edge Function
  ↓
Check credits → Generate embedding → Vector search
  ↓
Call Gemini AI → Stream response
  ↓
Decrement credits (if free user)
```

---

## 🗄️ Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `documents` | File metadata | `status`, `needs_ocr`, `chunk_count` |
| `knowledge_base` | Text chunks | `embedding` (vector 384), `content` |
| `user_subscriptions` | Credits & plans | `plan`, `credits_remaining` |
| `conversations` | Chat sessions | `user_id`, `title` |
| `messages` | Chat history | `role`, `content`, `metadata` |
| `user_roles` | Admin access | `role` (admin/user) |

---

## 🔧 Key Technologies

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching
- **React Router** - Navigation
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling

### Backend
- **Supabase** - BaaS (PostgreSQL + Auth + Storage + Realtime)
- **pgvector** - Vector similarity search
- **Deno** - Edge Functions runtime

### Worker
- **Python 3.9+** - Worker runtime
- **sentence-transformers** - Embeddings (HuggingFace)
- **OCRmyPDF** - OCR processing
- **tiktoken** - Token counting
- **Redis** - Job queue

### AI
- **HuggingFace** - `all-MiniLM-L6-v2` (384-dim embeddings)
- **Google Gemini** - Chat responses

---

## 🛠️ Common Development Tasks

### Add a New Page

1. Create page component in `src/pages/`:
```tsx
// src/pages/NewPage.tsx
import { useAuth } from "@/hooks/useAuth";

const NewPage = () => {
  const { user } = useAuth();
  
  return (
    <div className="container mx-auto p-6">
      <h1>New Page</h1>
    </div>
  );
};

export default NewPage;
```

2. Add route in `src/App.tsx`:
```tsx
<Route 
  path="/new-page" 
  element={user ? <NewPage /> : <Navigate to="/auth" />} 
/>
```

### Add a New Database Table

1. Create migration in `supabase/migrations/`:
```sql
-- 20250127000000_add_new_table.sql
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own data"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

2. Update types in `src/integrations/supabase/types.ts`:
```typescript
export type Database = {
  public: {
    Tables: {
      new_table: {
        Row: {
          id: string
          user_id: string
          data: Json | null
          created_at: string
        }
        // ... Insert and Update types
      }
    }
  }
}
```

### Add a New Edge Function

1. Create function directory:
```bash
mkdir supabase/functions/my-function
```

2. Create `index.ts`:
```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Your logic here

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

3. Deploy:
```bash
supabase functions deploy my-function
```

### Modify Worker Processing

Edit `worker/worker.py`:

```python
def process_document(self, job_data: Dict[str, Any]):
    document_id = job_data['document_id']
    
    try:
        # Your custom processing logic
        self.update_status(document_id, 'processing', 'Custom step...')
        
        # ... rest of processing
        
    except Exception as e:
        self.update_status(document_id, 'failed', error=str(e))
```

---

## 🧪 Testing

### Test Edge Function Locally

```bash
# Start local Supabase
supabase start

# Serve function locally
supabase functions serve my-function --env-file .env

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Test Worker Locally

```bash
cd worker

# Build and run
docker-compose up --build

# Check logs
docker-compose logs -f worker

# Test by uploading a document through the frontend
```

### Test Frontend Component

```tsx
// src/components/__tests__/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

---

## 🐛 Debugging

### Frontend Debugging

1. **React DevTools**: Install browser extension
2. **Console Logs**: Check browser console
3. **Network Tab**: Monitor API calls
4. **React Query DevTools**: Already included in dev mode

### Edge Function Debugging

1. Check logs in Supabase dashboard:
   - Go to **Edge Functions** → Select function → **Logs**
2. Add console.log statements:
```typescript
console.log('Debug info:', data);
```

### Worker Debugging

1. Check Docker logs:
```bash
docker-compose logs -f worker
```

2. Add print statements:
```python
print(f"Debug: {variable}")
```

3. Connect to running container:
```bash
docker-compose exec worker bash
```

### Database Debugging

1. Check table data in Supabase **Table Editor**
2. Run queries in **SQL Editor**:
```sql
-- Check recent documents
SELECT * FROM documents 
ORDER BY created_at DESC 
LIMIT 10;

-- Check failed documents
SELECT * FROM documents 
WHERE status = 'failed'
ORDER BY created_at DESC;
```

---

## 📊 Performance Optimization

### Frontend

- Use React.memo for expensive components
- Lazy load routes with React.lazy
- Optimize images (use WebP format)
- Use TanStack Query caching effectively

### Database

- Add indexes for frequently queried fields
- Use RLS policies efficiently
- Monitor slow queries in Supabase dashboard

### Worker

- Adjust `BATCH_SIZE` for optimal throughput
- Monitor memory usage
- Scale horizontally (multiple workers) if needed

---

## 🔐 Security Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use RLS policies** - Protect all tables
3. **Validate inputs** - Both frontend and backend
4. **Use prepared statements** - Prevent SQL injection
5. **Sanitize user content** - Prevent XSS
6. **Rate limit APIs** - Prevent abuse
7. **Keep dependencies updated** - Run `npm audit`

---

## 📚 Useful Commands

### Frontend
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Supabase
```bash
supabase login                    # Login to Supabase
supabase link                     # Link to project
supabase db push                  # Push migrations
supabase functions deploy <name>  # Deploy function
supabase secrets set KEY=value    # Set secret
```

### Worker
```bash
docker-compose up --build         # Build and start
docker-compose down               # Stop
docker-compose logs -f worker     # View logs
docker-compose restart worker     # Restart
docker-compose exec worker bash   # Shell access
```

### Git
```bash
git status                        # Check status
git add .                         # Stage changes
git commit -m "message"           # Commit
git push origin main              # Push to remote
git pull origin main              # Pull from remote
```

---

## 🔗 Useful Links

- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [HuggingFace Docs](https://huggingface.co/docs)

---

## 💡 Tips & Tricks

1. **Hot Reload**: Frontend auto-reloads on save
2. **Type Safety**: Use TypeScript strictly, avoid `any`
3. **Component Reusability**: Extract common patterns
4. **Error Boundaries**: Wrap components to catch errors
5. **Loading States**: Always show loading indicators
6. **Optimistic Updates**: Update UI before API response
7. **Accessibility**: Use semantic HTML and ARIA labels
8. **Mobile First**: Design for mobile, scale up
9. **Git Commits**: Make small, focused commits
10. **Documentation**: Comment complex logic

---

**Happy coding! 🚀**
