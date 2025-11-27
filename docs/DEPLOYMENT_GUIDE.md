# 🚀 Production Deployment Guide

This guide walks you through deploying the RAG Book application to production. Follow these steps in order for a successful deployment.

---

## 📋 Prerequisites

Before starting, ensure you have accounts for:

- ✅ **Supabase** (free tier available)
- ✅ **Upstash Redis** (free tier available)
- ✅ **Render** or **Railway** (for worker hosting)
- ✅ **Paystack** (Nigerian payment gateway)
- ✅ **GitHub** (for code repository)

---

## 🗄️ Phase 1: Database Setup (20 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose organization and set project details:
   - **Name**: `rag-book-production`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### Step 2: Run Database Migrations

1. Navigate to **SQL Editor** in Supabase dashboard
2. Run the migration files from `supabase/migrations/` in **chronological order**:
   - `20250103000000_full_schema.sql`
   - `20250103000001_fix_embedding_dimensions_final.sql`
   - `20250103000002_security_logging_tables.sql`
   - `20250103000003_sovereign_centered_system.sql`
   - `20250123000000_create_user_subscriptions.sql`
   - `20250123000001_update_knowledge_base_to_384_dimensions.sql`
   - `20250123000002_update_documents_table.sql`

3. Verify tables were created:
   - Go to **Table Editor**
   - Confirm you see: `documents`, `knowledge_base`, `user_subscriptions`, `conversations`, `messages`, `user_roles`

### Step 3: Enable Realtime

1. Go to **Database → Replication**
2. Find the `documents` table
3. Enable replication
4. Select events: **INSERT** and **UPDATE**
5. Click **Save**

### Step 4: Configure Storage

1. Go to **Storage**
2. Verify the `documents` bucket exists
3. Click on `documents` bucket → **Policies**
4. Ensure bucket is **private** (authenticated users only)

### Step 5: Get API Credentials

1. Go to **Settings → API**
2. Copy and save these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (for frontend)
   - **service_role key**: `eyJhbGc...` (for worker - keep secret!)

---

## 🔴 Phase 2: Redis Setup (10 minutes)

### Option A: Upstash (Recommended)

1. Go to [upstash.com](https://upstash.com)
2. Sign up with GitHub or email
3. Click **Create Database**
4. Configure:
   - **Name**: `pdf-processing-queue`
   - **Type**: Regional
   - **Region**: Choose closest to your worker location
   - **TLS**: Enabled
5. Click **Create**
6. Copy the **Redis URL** (format: `redis://default:password@host:port`)

### Option B: Railway Redis

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Click **+ New** → **Database** → **Add Redis**
4. Copy `REDIS_URL` from the **Variables** tab

---

## 🐳 Phase 3: Worker Deployment (30 minutes)

### Step 1: Prepare Worker Repository

```bash
# Navigate to worker directory
cd worker/

# Initialize git (if not already)
git init

# Create .gitignore
echo ".env
__pycache__/
*.pyc
.DS_Store" > .gitignore

# Commit code
git add .
git commit -m "Initial worker setup"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/rag-book-worker.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click **New +** → **Web Service**
4. Connect your `rag-book-worker` repository
5. Configure service:
   - **Name**: `rag-book-worker`
   - **Environment**: **Docker**
   - **Region**: Choose same as Redis
   - **Branch**: `main`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: 
     - **Free** (for testing)
     - **Starter** ($7/mo - recommended for production)

### Step 3: Add Environment Variables

In the Render dashboard, add these environment variables:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  # service_role key from Supabase
REDIS_URL=redis://default:password@host:port
BATCH_SIZE=32
CHUNK_SIZE=500
CHUNK_OVERLAP=50
OCR_LANGUAGES=eng
OCR_DPI=300
LOG_LEVEL=INFO
```

### Step 4: Deploy and Verify

1. Click **Create Web Service**
2. Wait for build to complete (~5-10 minutes)
3. Check **Logs** tab for:
   ```
   🚀 Initializing PDF Worker...
   ✓ Connected to Supabase
   ✓ Connected to Redis
   ✓ Listening to queue: pdf-processing
   🎯 Worker ready. Waiting for jobs...
   ```

---

## ⚡ Phase 4: Edge Functions Deployment (20 minutes)

### Step 1: Install Supabase CLI

```bash
# Install globally
npm install -g supabase

# Verify installation
supabase --version
```

### Step 2: Login and Link Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

**Note**: Find your project ref in Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### Step 3: Set Secrets

```bash
# Redis credentials
supabase secrets set REDIS_URL="redis://default:password@host:port"

# Paystack (use test keys for now)
supabase secrets set PAYSTACK_SECRET_KEY="sk_test_..."

# Google Gemini API key
supabase secrets set GEMINI_API_KEY="your-gemini-api-key"

# HuggingFace API key (optional - worker uses local model by default)
supabase secrets set HUGGINGFACE_API_KEY="hf_..."

# Verify secrets were set
supabase secrets list
```

### Step 4: Deploy Functions

```bash
# Navigate to project root
cd ..

# Deploy all functions
supabase functions deploy submit-document
supabase functions deploy rag-chat-credits
supabase functions deploy paystack-webhook

# Verify deployment
supabase functions list
```

### Step 5: Test Functions

```bash
# Test submit-document (replace with real document ID)
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_id":"test-uuid"}'
```

---

## 💳 Phase 5: Monnify Setup (15 minutes)

### Step 1: Create Monnify Account

1. Go to [monnify.com](https://monnify.com)
2. Sign up (requires Nigerian phone number)
3. Complete email verification
4. Complete KYC verification (for live mode)

### Step 2: Get API Keys

1. Navigate to **Settings → API Keys & Webhooks**
2. For testing, use **Test Keys**:
   - **Public Key**: `pub_...` (for frontend)
   - **Secret Key**: `secret_...` (already set in Edge Functions)
3. For production, switch to **Live Keys** after testing
4. Also copy your **Contract Code** from the dashboard

### Step 3: Configure Webhook

1. In Monnify dashboard, go to **Settings → Webhooks**
2. Click **Add Endpoint**
3. Enter webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/monnify-webhook
   ```
4. Select events to listen for:
   - ✅ `SUCCESSFUL_TRANSACTION`
   - ✅ `MANDATE_UPDATE`
5. Click **Add Endpoint**

### Step 4: Test Payment Flow

Use Monnify test cards:

| Card Number | CVV | PIN | Expiry | Result |
|-------------|-----|-----|--------|--------|
| 5060 6666 6666 6666 6666 | 123 | 1234 | Any future date | Success |
| 5060 6666 6666 6666 6661 | 123 | 1234 | Any future date | Declined |

---

## 🎨 Phase 6: Frontend Deployment (15 minutes)

### Step 1: Configure Environment Variables

Create `.env.production` in project root:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # anon key from Supabase
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...  # or pk_live_ for production
```

### Step 2: Update index.html

Ensure Paystack script is included in `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- ... other head content ... -->
    <script src="https://js.paystack.co/v1/inline.js"></script>
  </head>
  <body>
    <!-- ... body content ... -->
  </body>
</html>
```

### Step 3: Build Application

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test build locally
npm run preview
```

### Step 4: Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts:
# - Link to existing project? No
# - Project name: rag-book
# - Directory: ./
# - Override settings? No
```

**Alternative: Deploy to Netlify**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod

# Follow prompts and select ./dist as publish directory
```

---

## ✅ Phase 7: Testing & Verification (20 minutes)

### Test 1: User Registration

1. Visit your deployed frontend URL
2. Click **Sign Up**
3. Create a new account
4. Verify email (check spam folder)
5. Check Supabase:
   - Go to **Authentication → Users**
   - Confirm user exists
   - Go to **Table Editor → user_subscriptions**
   - Verify subscription created with 50 credits

### Test 2: Document Upload & Processing

1. Login to your application
2. Navigate to **Documents** page
3. Upload a small PDF (5-10 pages)
4. Click **Process Document**
5. Watch status change: `pending` → `queued` → `processing` → `completed`
6. Check Supabase:
   - **Table Editor → documents**: Verify status is `completed`
   - **Table Editor → knowledge_base**: Verify chunks were created

### Test 3: Chat with RAG

1. Navigate to **Chat** page
2. Send a message related to your uploaded document
3. Verify:
   - Response is generated
   - Sources are shown
   - Credits decrement (50 → 49)
4. Check **CreditsDisplay** component shows updated count

### Test 4: Payment Flow (Test Mode)

1. Click **Upgrade to Pro** or navigate to `/pricing`
2. Click **Subscribe** on Pro plan
3. Use test card: `5060 6666 6666 6666 6666`
4. Complete payment
5. Verify:
   - Payment successful message
   - Credits updated to 1000
   - Plan changed to `pro`
6. Send a chat message - credits should NOT decrement

### Test 5: OCR Processing (Pro Users)

1. Upload a scanned PDF
2. Process document
3. Verify `needs_ocr` is set to `true`
4. Wait for processing (takes longer)
5. Verify text was extracted correctly

---

## 🔍 Troubleshooting

### Worker Not Starting

**Check Logs**:
```bash
# In Render dashboard, go to Logs tab
# Look for errors in startup sequence
```

**Common Issues**:
- Missing environment variables
- Invalid Redis URL
- Invalid Supabase credentials

**Solution**:
- Verify all environment variables are set correctly
- Test Redis connection: `redis-cli -u $REDIS_URL PING`
- Test Supabase connection in worker logs

### Document Stuck in "queued"

**Check**:
1. Worker logs in Render
2. Redis queue length: `redis-cli -u $REDIS_URL LLEN pdf-processing`
3. Worker health status

**Solution**:
- Restart worker in Render dashboard
- Check worker has enough memory (upgrade instance if needed)
- Verify Redis URL is correct

### Payment Webhook Not Working

**Check**:
1. Paystack webhook logs (in Paystack dashboard)
2. Edge Function logs (in Supabase dashboard)
3. Webhook URL is correct

**Solution**:
- Re-send webhook from Paystack dashboard
- Verify webhook URL matches exactly
- Check Edge Function has correct `PAYSTACK_SECRET_KEY`

---

## 📊 Monitoring & Maintenance

### Daily Checks

1. **Worker Health**:
   - Check Render dashboard for uptime
   - Verify worker is processing jobs
   - Monitor memory/CPU usage

2. **Queue Metrics**:
   - Check Upstash dashboard
   - Queue length should be near 0
   - Monitor command count

3. **Database**:
   - Check Supabase dashboard
   - Monitor storage usage
   - Check for failed documents

### Weekly Reports

Run these queries in Supabase SQL Editor:

```sql
-- Active users (last 7 days)
SELECT COUNT(DISTINCT user_id) as active_users
FROM messages 
WHERE created_at > NOW() - INTERVAL '7 days';

-- Documents processed this week
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days';

-- Revenue (MRR)
SELECT 
  COUNT(*) as pro_subscribers,
  COUNT(*) * 3000 as mrr_ngn
FROM user_subscriptions
WHERE plan = 'pro' 
  AND (subscription_end_date IS NULL OR subscription_end_date > NOW());
```

---

## 🎯 Go Live Checklist

Before switching to production:

- [ ] All migrations applied successfully
- [ ] Worker deployed and running (24+ hours uptime)
- [ ] All Edge Functions deployed and tested
- [ ] Monnify webhook configured and tested
- [ ] Test payment successful with test card
- [ ] **Switch to Monnify live keys**
- [ ] **Update frontend with live Monnify keys**
- [ ] Test complete user journey end-to-end
- [ ] Set up monitoring alerts (Render, Upstash, Supabase)
- [ ] Enable Supabase daily backups
- [ ] Document admin procedures
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Configure custom domain (optional)
- [ ] Set up SSL certificate (handled by Vercel/Netlify)

---

## 🔒 Security Checklist

- [ ] All API keys stored as environment variables (never in code)
- [ ] Row-Level Security (RLS) enabled on all tables
- [ ] Webhook signature verification enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (React handles this)
- [ ] HTTPS enforced on all endpoints

---

## 📝 Post-Deployment Notes

### Scaling Considerations

**When to upgrade**:
- Worker CPU > 80% consistently
- Queue length > 10 consistently
- Database storage > 80%
- Response times > 2 seconds

**How to scale**:
1. **Worker**: Upgrade Render instance type
2. **Database**: Upgrade Supabase plan
3. **Redis**: Upgrade Upstash plan
4. **Multiple Workers**: Deploy additional worker instances

### Backup Strategy

1. **Database**: Enable daily backups in Supabase
2. **Storage**: Supabase handles this automatically
3. **Code**: Keep GitHub repository up to date

### Cost Estimates

**Free Tier (Testing)**:
- Supabase: Free
- Upstash Redis: Free
- Render Worker: Free (750 hours/month)
- **Total: ₦0/month**

**Production (Small Scale)**:
- Supabase: Free or $25/month
- Upstash Redis: Free or $10/month
- Render Worker: $7/month (Starter)
- Vercel: Free
- **Total: ~₦3,500-15,000/month**

**Production (Medium Scale)**:
- Supabase Pro: $25/month
- Upstash Redis: $10/month
- Render Worker: $25/month (Standard)
- Vercel Pro: $20/month
- **Total: ~₦30,000-40,000/month**

---

## 🆘 Support

If you encounter issues:

1. Check logs (Worker, Edge Functions, Browser Console)
2. Review this guide's troubleshooting section
3. Check service status pages:
   - [Supabase Status](https://status.supabase.com)
   - [Render Status](https://status.render.com)
   - [Upstash Status](https://status.upstash.com)
4. Search GitHub issues
5. Create a new GitHub issue with:
   - Error messages
   - Steps to reproduce
   - Environment details

---

**Congratulations! Your RAG Book application is now live! 🎉**

**Built with ❤️ for students**
