# Python Worker Development Rules

**Activation Mode**: Glob Pattern: `worker/**/*.py`

## Tech Stack
- **Language**: Python 3.9+
- **Container**: Docker
- **Libraries**: sentence-transformers, OCRmyPDF, supabase-py
- **Queue**: Redis (Upstash)

## Worker Architecture

### Main Components
- `worker.py` - Main worker loop that polls Redis
- `ocr_processor.py` - OCR processing with OCRmyPDF
- `embeddings.py` - Embedding generation with HuggingFace
- `chunker.py` - Text chunking logic
- `config.py` - Configuration and environment variables

## Python Best Practices

### Code Style
- Follow PEP 8 style guide
- Use type hints for function parameters and return values
- Keep functions small and focused
- Use descriptive variable names
- Add docstrings to all functions and classes

### Error Handling
- Use try-except blocks for all external operations
- Log errors with appropriate severity levels
- Update document status to 'failed' on errors
- Include error messages in database for user visibility
- Don't let worker crash on single job failure

### Logging
- Use Python's logging module
- Set log level from environment variable (LOG_LEVEL)
- Include timestamps and context in logs
- Log job start, progress, and completion
- Log errors with full stack traces

## Worker Loop Pattern

### Job Processing Flow
```python
# 1. Poll Redis for new jobs (blocking with timeout)
# 2. Parse job payload
# 3. Update document status to 'processing'
# 4. Download PDF from Supabase Storage
# 5. Check if OCR is needed
# 6. Extract/OCR text
# 7. Chunk text into manageable pieces
# 8. Generate embeddings in batches
# 9. Store chunks and embeddings in database
# 10. Update document status to 'completed'
# 11. Handle errors and update status accordingly
```

### Status Updates
- Update status frequently for real-time feedback
- Include progress information (processed_chunks/total_chunks)
- Set status_message for user-friendly updates
- Update timestamps (processing_started_at, processing_completed_at)

## OCR Processing

### OCRmyPDF Configuration
- Use appropriate DPI (default: 300)
- Support multiple languages (configurable via OCR_LANGUAGES)
- Skip OCR if text already exists
- Handle corrupted PDFs gracefully
- Set reasonable timeout for OCR operations

### OCR Best Practices
- Check if OCR is needed before processing
- Use `--skip-text` flag to avoid re-OCRing
- Handle OCR failures without crashing worker
- Log OCR progress and results
- Clean up temporary files after processing

## Embedding Generation

### HuggingFace Integration
- Use `all-MiniLM-L6-v2` model (384-dimensional)
- Process embeddings in batches (BATCH_SIZE=32)
- Handle model loading errors
- Cache model in memory (don't reload per job)
- Use GPU if available, fallback to CPU

### Embedding Best Practices
- Normalize embeddings before storage
- Validate embedding dimensions (must be 384)
- Handle empty text chunks
- Batch process for efficiency
- Log embedding generation time

## Text Chunking

### Chunking Configuration
- Default chunk size: 500 tokens
- Default overlap: 50 tokens
- Use tiktoken or similar for token counting
- Preserve sentence boundaries when possible

### Chunking Best Practices
- Don't create chunks that are too small (<50 tokens)
- Maintain context with overlap
- Track chunk index for ordering
- Store token count with each chunk
- Handle edge cases (very short documents)

## Database Operations

### Supabase Integration
- Use service role key for worker operations
- Use batch inserts for chunks and embeddings
- Handle connection errors with retries
- Use transactions for atomic operations
- Update document metadata correctly

### Database Best Practices
- Use parameterized queries
- Handle unique constraint violations
- Clean up failed job data
- Update chunk_count accurately
- Set proper foreign key relationships

## Configuration Management

### Environment Variables
```python
# Required
SUPABASE_URL
SUPABASE_SERVICE_KEY
REDIS_URL

# Processing
BATCH_SIZE=32
CHUNK_SIZE=500
CHUNK_OVERLAP=50

# OCR
OCR_LANGUAGES=eng
OCR_DPI=300

# Logging
LOG_LEVEL=INFO
```

### Configuration Best Practices
- Validate all required env vars at startup
- Provide sensible defaults
- Use type conversion (int, bool) for non-string values
- Document all configuration options
- Fail fast if critical config is missing

## Docker Best Practices

### Dockerfile
- Use official Python base image
- Install system dependencies (tesseract, poppler)
- Copy requirements.txt first for layer caching
- Use multi-stage builds if needed
- Set proper working directory

### Docker Compose
- Mount volumes for development
- Set environment variables
- Configure restart policy (unless-stopped)
- Use health checks
- Set resource limits if needed

## Performance Optimization
- Process embeddings in batches
- Use connection pooling for database
- Cache HuggingFace model in memory
- Clean up temporary files promptly
- Monitor memory usage

## Monitoring & Debugging
- Log all job processing steps
- Track processing time per document
- Monitor queue length
- Log Redis connection status
- Include job_id in all log messages
