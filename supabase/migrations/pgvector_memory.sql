-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS miyu_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- Optimized for OpenAI/Gemini embeddings
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON miyu_memory USING ivfflat (embedding vector_cosine_ops);