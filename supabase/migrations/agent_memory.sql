-- Agent memory: vector store for agentic reasoning and context recall
-- Consolidated from: pgvector_memory.sql, alter_rename_miyu_memory.sql,
--                    alter_add_system_status_fks.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.agent_memory (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_bsuid TEXT REFERENCES public.profiles(bsuid),
    content     TEXT NOT NULL,
    embedding   vector(1536),   -- Compatible with OpenAI/Azure OpenAI/Anthropic embeddings
    metadata    JSONB,          -- Stores message ID, source (voice/text), channel
    status_fk   INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- High-velocity approximate nearest-neighbour vector search
CREATE INDEX ON public.agent_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
