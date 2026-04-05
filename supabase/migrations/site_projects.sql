-- Site Projects: UEN-based BCA project registry
-- Each subscription may have multiple site projects (one per building contract).
-- project_ref maps to BCA project_id (e.g. "UEN2018XXXX-PRJ001").

CREATE TABLE IF NOT EXISTS public.site_projects (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id         UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,

    -- BCA / SGBuildex identifiers
    project_ref             TEXT NOT NULL,          -- BCA project_id (UEN-prefixed)
    uen                     TEXT NOT NULL,           -- builder UEN
    project_name            TEXT NOT NULL,
    address                 TEXT,

    -- Geolocation (verified via device or manual entry)
    lat                     NUMERIC(9, 6),
    long                    NUMERIC(9, 6),
    geolocation_verified    BOOLEAN DEFAULT FALSE,

    -- Lifecycle
    status_fk               INT REFERENCES public.system_status(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_site_project_ref UNIQUE (subscription_id, project_ref)
);

CREATE INDEX IF NOT EXISTS idx_site_projects_subscription ON public.site_projects(subscription_id);
CREATE INDEX IF NOT EXISTS idx_site_projects_uen          ON public.site_projects(uen);
