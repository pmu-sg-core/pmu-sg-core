-- Rename miyu_memory to agent_memory (vendor-agnostic naming)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'miyu_memory') THEN
        ALTER TABLE public.miyu_memory RENAME TO agent_memory;
    END IF;
END $$;
