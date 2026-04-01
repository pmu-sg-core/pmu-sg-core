-- Enable pgvector for agentic reasoning
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE miyu_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_bsuid TEXT REFERENCES profiles(bsuid),
  content TEXT NOT NULL,
  embedding vector(1536), -- Optimized for OpenAI/Azure OpenAI embeddings
  metadata JSONB,         -- Stores WhatsApp Message ID, Source (Voice/Text)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-velocity vector search
CREATE INDEX ON miyu_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);